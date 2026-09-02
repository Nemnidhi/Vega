import crypto from "node:crypto";
import * as XLSX from "xlsx";
import mongoose, { type ClientSession } from "mongoose";
import { logActivity } from "@/lib/activity/logging";
import { createDependency } from "@/lib/tasks/dependencies";
import { assertCanAssignSubtask, generateSubtaskCode } from "@/lib/tasks/subtasks";
import { ImportJobModel, TaskModel, UserModel } from "@/models";
import type { UserRole } from "@/types/user";
import type { importFieldSchema } from "@/lib/validation/task";
import type { z } from "zod";

type ImportField = z.infer<typeof importFieldSchema>;
type ImportMapping = Record<string, ImportField>;
type ParsedRow = {
  rowNumber: number;
  values: Record<string, string>;
};
type RowIssue = {
  rowNumber: number;
  level: "warning" | "error";
  field: string;
  message: string;
};
type NormalizedImportRow = {
  rowNumber: number;
  externalId: string;
  title: string;
  description: string;
  assignedTo: string;
  assigneeEmail: string;
  assignedToUserId: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "NOT_STARTED" | "READY" | "IN_PROGRESS" | "WAITING" | "BLOCKED" | "REVIEW" | "COMPLETED" | "CANCELLED";
  startAt: Date | null;
  dueAt: Date | null;
  estimatedEffortHours: number | null;
  dependsOn: string[];
  stage: string;
  tags: string[];
  fingerprint: string;
  errors: RowIssue[];
  warnings: RowIssue[];
};

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 1000;
const MAX_IMPORT_COLUMNS = 80;

const TEMPLATE_HEADERS = [
  "Subtask ID",
  "Subtask Name",
  "Description",
  "Assigned To",
  "Assignee Email",
  "Priority",
  "Status",
  "Start Date",
  "Due Date",
  "Estimated Hours",
  "Depends On",
  "Stage",
  "Tags",
];

const FIELD_LABELS: Record<Exclude<ImportField, "ignore">, string> = {
  subtaskId: "Subtask ID",
  name: "Subtask Name",
  description: "Description",
  assignedTo: "Assigned To",
  assigneeEmail: "Assignee Email",
  priority: "Priority",
  status: "Status",
  startDate: "Start Date",
  dueDate: "Due Date",
  estimatedHours: "Estimated Hours",
  dependsOn: "Depends On",
  stage: "Stage",
  tags: "Tags",
};

const STATUS_ALIASES = new Map([
  ["NOTSTARTED", "NOT_STARTED"],
  ["NOT STARTED", "NOT_STARTED"],
  ["READY", "READY"],
  ["INPROGRESS", "IN_PROGRESS"],
  ["IN PROGRESS", "IN_PROGRESS"],
  ["WAITING", "WAITING"],
  ["BLOCKED", "BLOCKED"],
  ["REVIEW", "REVIEW"],
  ["IN REVIEW", "REVIEW"],
  ["CLIENT REVIEW", "CLIENT_REVIEW"],
  ["CLIENTREVIEW", "CLIENT_REVIEW"],
  ["COMPLETED", "COMPLETED"],
  ["COMPLETE", "COMPLETED"],
  ["DONE", "COMPLETED"],
  ["CANCELLED", "CANCELLED"],
  ["CANCELED", "CANCELLED"],
  // Legacy values, so a sheet exported from older Vega data re-imports cleanly.
  ["TODO", "NOT_STARTED"],
  ["BACKLOG", "NOT_STARTED"],
]);

const PRIORITY_ALIASES = new Map([
  ["LOW", "LOW"],
  ["MEDIUM", "MEDIUM"],
  ["NORMAL", "MEDIUM"],
  ["HIGH", "HIGH"],
  ["URGENT", "URGENT"],
]);

export function resolveImportStatus(value: string) {
  return STATUS_ALIASES.get(normalizeToken(value).replace(/_/g, " ")) ?? "";
}

export function resolveImportPriority(value: string) {
  return PRIORITY_ALIASES.get(normalizeToken(value).replace(/[^A-Z]/g, "")) ?? "";
}

export function getImportTemplateHeaders() {
  return TEMPLATE_HEADERS;
}

function hashBuffer(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function hashText(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeHeader(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function cellToString(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

export function hasSpreadsheetFormulaRisk(value: string) {
  return /^[=+\-@]/.test(value.trim());
}

function normalizeToken(value: string) {
  return value.trim().toUpperCase();
}

function splitList(value: string) {
  return value
    .split(/[,\n;]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDate(value: string) {
  if (!value) return { value: null, valid: true };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { value: null, valid: false };
  return { value: parsed, valid: true };
}

function parseNumber(value: string) {
  if (!value) return { value: null, valid: true };
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return { value: null, valid: false };
  return { value: parsed, valid: true };
}

function emailValid(value: string) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function issue(rowNumber: number, level: "warning" | "error", field: string, message: string): RowIssue {
  return { rowNumber, level, field, message };
}

export function autoMapHeaders(headers: string[]): ImportMapping {
  const aliases: Record<Exclude<ImportField, "ignore">, string[]> = {
    subtaskId: ["subtaskid", "subtaskcode", "id", "code", "stid"],
    name: ["subtaskname", "taskname", "name", "title", "subtask", "task"],
    description: ["description", "details", "notes", "remark", "remarks"],
    assignedTo: ["assignedto", "assignee", "owner", "ownername"],
    assigneeEmail: ["assigneeemail", "owneremail", "email", "assignedemail"],
    priority: ["priority", "importance"],
    status: ["status", "state"],
    startDate: ["startdate", "start", "begin", "begindate"],
    dueDate: ["duedate", "deadline", "due", "targetdate"],
    estimatedHours: ["estimatedhours", "estimate", "estimatedeffort", "hours", "effort"],
    dependsOn: ["dependson", "dependencies", "dependency", "blockedby", "predecessor"],
    stage: ["stage", "phase", "lane"],
    tags: ["tags", "tag", "labels"],
  };
  const mapping: ImportMapping = {};
  for (const header of headers) {
    const key = normalizeKey(header);
    const match = Object.entries(aliases).find(([, values]) => values.includes(key));
    mapping[header] = match ? (match[0] as ImportField) : "ignore";
  }
  return mapping;
}

/**
 * Reject a file whose content does not match the extension it claims.
 *
 * SheetJS is deliberately permissive: handed arbitrary bytes with an .xlsx name it will often
 * parse them as a single-column sheet rather than failing, so a corrupt or mislabelled upload
 * surfaced as confusing row-level validation errors instead of "this is not a spreadsheet".
 * Checking the container signature turns that into one clear rejection.
 *
 * Signatures: xlsx is a zip container (PK); xls is an OLE2 compound document
 * (D0 CF 11 E0 A1 B1 1A E1). csv is plain text and has none, so it is only checked for the NUL
 * bytes that indicate a binary file wearing a .csv name.
 */
function assertContentMatchesExtension(buffer: Buffer, ext: "xlsx" | "xls" | "csv") {
  if (buffer.length === 0) {
    throw new Error("Import file is empty.");
  }

  if (ext === "xlsx") {
    const isZip =
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07);
    if (!isZip) {
      throw new Error("File is not a valid .xlsx workbook.");
    }
    return;
  }

  if (ext === "xls") {
    const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    const isOle = buffer.length >= 8 && ole.every((byte, index) => buffer[index] === byte);
    // Some tools emit .xls names for zip-based or plain-text sheets, so accept those too rather
    // than rejecting a file the parser could genuinely read.
    const isZip = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
    if (!isOle && !isZip) {
      throw new Error("File is not a valid .xls workbook.");
    }
    return;
  }

  if (buffer.subarray(0, 8192).includes(0x00)) {
    throw new Error("File is not valid CSV text.");
  }
}

export function parseSpreadsheet(buffer: Buffer, fileName: string) {
  const ext = fileName.toLowerCase().split(".").pop();
  if (!ext || !["xlsx", "xls", "csv"].includes(ext)) {
    throw new Error("Unsupported file format.");
  }
  if (buffer.length > MAX_IMPORT_FILE_BYTES) {
    throw new Error("Import file is too large. Maximum size is 5 MB.");
  }

  assertContentMatchesExtension(buffer, ext as "xlsx" | "xls" | "csv");

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("Workbook has no sheets.");
  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false });
  if (matrix.length === 0) throw new Error("Spreadsheet has no rows.");

  const headers = (matrix[0] ?? []).map(normalizeHeader).filter(Boolean);
  if (headers.length === 0) throw new Error("Spreadsheet header row is empty.");
  if (headers.length > MAX_IMPORT_COLUMNS) {
    throw new Error(`Spreadsheet has too many columns. Maximum is ${MAX_IMPORT_COLUMNS}.`);
  }

  const rows: ParsedRow[] = matrix.slice(1).map((row, index) => {
    const values: Record<string, string> = {};
    headers.forEach((header, columnIndex) => {
      values[header] = cellToString(row[columnIndex]);
    });
    return { rowNumber: index + 2, values };
  }).filter((row) => Object.values(row.values).some(Boolean));
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Spreadsheet has too many rows. Maximum is ${MAX_IMPORT_ROWS}.`);
  }

  return {
    fileType: ext as "xlsx" | "xls" | "csv",
    fileHash: hashBuffer(buffer),
    headers,
    rows,
    previewRows: rows.slice(0, 50),
    mapping: autoMapHeaders(headers),
  };
}

function readMappedValue(row: ParsedRow, mapping: ImportMapping, field: ImportField) {
  const header = Object.entries(mapping).find(([, mappedField]) => mappedField === field)?.[0];
  return header ? row.values[header] ?? "" : "";
}

async function buildUserMaps() {
  const users = await UserModel.find({ status: "active" }).select("_id fullName email").lean();
  const byEmail = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const user of users) {
    byEmail.set(String(user.email).trim().toLowerCase(), String(user._id));
    byName.set(String(user.fullName).trim().toLowerCase(), String(user._id));
  }
  return { byEmail, byName };
}

function normalizeRows(
  rows: ParsedRow[],
  mapping: ImportMapping,
  fileHash: string,
  parentTaskId: string,
  userMaps: Awaited<ReturnType<typeof buildUserMaps>>,
) {
  const seenExternalIds = new Set<string>();
  // Content signature -> first row that used it, so a repeated line can name its original.
  const seenContent = new Map<string, number>();
  const normalized: NormalizedImportRow[] = [];

  for (const row of rows) {
    const errors: RowIssue[] = [];
    const warnings: RowIssue[] = [];
    const externalId = normalizeToken(readMappedValue(row, mapping, "subtaskId"));
    const title = readMappedValue(row, mapping, "name").trim();
    const description = readMappedValue(row, mapping, "description").trim();
    const assignedTo = readMappedValue(row, mapping, "assignedTo").trim();
    const assigneeEmail = readMappedValue(row, mapping, "assigneeEmail").trim().toLowerCase();
    const priorityRaw = normalizeToken(readMappedValue(row, mapping, "priority")).replace(/[^A-Z]/g, "");
    const statusRaw = normalizeToken(readMappedValue(row, mapping, "status")).replace(/_/g, " ");
    const startDate = parseDate(readMappedValue(row, mapping, "startDate"));
    const dueDate = parseDate(readMappedValue(row, mapping, "dueDate"));
    const estimatedHours = parseNumber(readMappedValue(row, mapping, "estimatedHours"));
    const dependsOn = splitList(readMappedValue(row, mapping, "dependsOn")).map(normalizeToken);
    const stage = readMappedValue(row, mapping, "stage").trim();
    const tags = splitList(readMappedValue(row, mapping, "tags")).slice(0, 30);
    const priority = (PRIORITY_ALIASES.get(priorityRaw) ?? "") as NormalizedImportRow["priority"];
    const status = (STATUS_ALIASES.get(statusRaw) ?? "") as NormalizedImportRow["status"];

    const formulaFields = [
      ["subtaskId", externalId],
      ["name", title],
      ["description", description],
      ["assignedTo", assignedTo],
      ["assigneeEmail", assigneeEmail],
      ["dependsOn", readMappedValue(row, mapping, "dependsOn")],
      ["stage", stage],
      ["tags", readMappedValue(row, mapping, "tags")],
    ] as const;
    for (const [field, value] of formulaFields) {
      if (value && hasSpreadsheetFormulaRisk(value)) {
        errors.push(issue(row.rowNumber, "error", field, "Spreadsheet formulas are not allowed in imported text fields."));
      }
    }

    if (!title) errors.push(issue(row.rowNumber, "error", "name", "Subtask name is required."));
    if (title.length > 200) errors.push(issue(row.rowNumber, "error", "name", "Subtask name is too long."));
    if (description.length > 5000) errors.push(issue(row.rowNumber, "error", "description", "Description is too long."));
    if (externalId.length > 80) errors.push(issue(row.rowNumber, "error", "subtaskId", "Subtask ID is too long."));
    if (externalId && seenExternalIds.has(externalId)) {
      errors.push(issue(row.rowNumber, "error", "subtaskId", `Duplicate subtask ID ${externalId}.`));
    }
    if (externalId) seenExternalIds.add(externalId);
    if (assigneeEmail && !emailValid(assigneeEmail)) {
      errors.push(issue(row.rowNumber, "error", "assigneeEmail", "Assignee email is invalid."));
    }
    const assignedToUserId = assigneeEmail
      ? userMaps.byEmail.get(assigneeEmail) ?? null
      : assignedTo
        ? userMaps.byName.get(assignedTo.toLowerCase()) ?? null
        : null;
    if ((assigneeEmail || assignedTo) && !assignedToUserId) {
      errors.push(issue(row.rowNumber, "error", "assignee", "Assignee was not found among active users."));
    }
    if (readMappedValue(row, mapping, "priority") && !priority) {
      errors.push(issue(row.rowNumber, "error", "priority", "Priority must be LOW, MEDIUM, HIGH, or URGENT."));
    }
    if (readMappedValue(row, mapping, "status") && !status) {
      errors.push(issue(row.rowNumber, "error", "status", "Status is invalid."));
    }
    if (!startDate.valid) errors.push(issue(row.rowNumber, "error", "startDate", "Start date is invalid."));
    if (!dueDate.valid) errors.push(issue(row.rowNumber, "error", "dueDate", "Due date is invalid."));
    if (startDate.value && dueDate.value && startDate.value > dueDate.value) {
      errors.push(issue(row.rowNumber, "error", "dueDate", "Due date cannot be before start date."));
    }
    if (!estimatedHours.valid) {
      errors.push(issue(row.rowNumber, "error", "estimatedHours", "Estimated hours must be a positive number."));
    }
    if (stage.length > 120) errors.push(issue(row.rowNumber, "error", "stage", "Stage is too long."));
    for (const tag of tags) {
      if (tag.length > 40) errors.push(issue(row.rowNumber, "error", "tags", "Tags must be 40 characters or fewer."));
    }
    if (!externalId && dependsOn.length > 0) {
      warnings.push(issue(row.rowNumber, "warning", "subtaskId", "Rows with dependencies should have a Subtask ID."));
    }

    // A repeated line is usually a copy-paste slip rather than two genuinely identical subtasks,
    // but it is not certain enough to reject - warn and let the importer decide.
    if (title) {
      const signature = [title.toLowerCase(), assigneeEmail, dueDate.value?.toISOString() ?? ""].join("|");
      const firstSeenAt = seenContent.get(signature);
      if (firstSeenAt) {
        warnings.push(
          issue(row.rowNumber, "warning", "name", `Same name, assignee and due date as row ${firstSeenAt}.`),
        );
      } else {
        seenContent.set(signature, row.rowNumber);
      }
    }

    const fingerprint = hashText(
      [parentTaskId, fileHash, row.rowNumber, externalId, title.toLowerCase(), assigneeEmail].join("|"),
    );

    normalized.push({
      rowNumber: row.rowNumber,
      externalId,
      title,
      description,
      assignedTo,
      assigneeEmail,
      assignedToUserId,
      priority: priority || "MEDIUM",
      status: status || "NOT_STARTED",
      startAt: startDate.value,
      dueAt: dueDate.value,
      estimatedEffortHours: estimatedHours.value,
      dependsOn,
      stage,
      tags,
      fingerprint,
      errors,
      warnings,
    });
  }

  return normalized;
}

export function validateDependencies(rows: NormalizedImportRow[]) {
  const byExternalId = new Map(rows.filter((row) => row.externalId).map((row) => [row.externalId, row]));
  const adjacency = new Map<string, string[]>();

  for (const row of rows) {
    for (const dependency of row.dependsOn) {
      if (!byExternalId.has(dependency)) {
        row.errors.push(issue(row.rowNumber, "error", "dependsOn", `Dependency ${dependency} does not match an imported row.`));
        continue;
      }
      if (dependency === row.externalId) {
        row.errors.push(issue(row.rowNumber, "error", "dependsOn", "A row cannot depend on itself."));
        continue;
      }
      // A row with no Subtask ID cannot be a dependency target; adding it would put an empty
      // string into the graph as a node. The missing-ID case is already warned about above.
      if (!row.externalId) continue;
      adjacency.set(dependency, [...(adjacency.get(dependency) ?? []), row.externalId]);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cyclic = new Set<string>();

  function visit(node: string, trail: string[]) {
    if (visiting.has(node)) {
      trail.slice(trail.indexOf(node)).forEach((item) => cyclic.add(item));
      cyclic.add(node);
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of adjacency.get(node) ?? []) visit(next, [...trail, node]);
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of adjacency.keys()) visit(node, []);
  for (const row of rows) {
    if (row.externalId && cyclic.has(row.externalId)) {
      row.errors.push(issue(row.rowNumber, "error", "dependsOn", "Circular dependency detected in import rows."));
    }
  }
}

export async function validateImportJob(importJobId: string, mapping: ImportMapping) {
  const job = await ImportJobModel.findById(importJobId);
  if (!job) throw new Error("Import job not found.");
  const userMaps = await buildUserMaps();
  const normalizedRows = normalizeRows(
    job.rows as ParsedRow[],
    mapping,
    job.fileHash,
    String(job.parentTaskId),
    userMaps,
  );
  validateDependencies(normalizedRows);

  const issues = normalizedRows.flatMap((row) => [...row.errors, ...row.warnings]);
  const errorCount = issues.filter((item) => item.level === "error").length;
  const warningCount = issues.filter((item) => item.level === "warning").length;
  const validRows = normalizedRows.filter((row) => row.errors.length === 0).length;

  job.status = "validated";
  job.mapping = mapping;
  job.issues = issues;
  job.summary = {
    totalRows: normalizedRows.length,
    validRows,
    warningCount,
    errorCount,
    importedRows: job.summary.importedRows ?? 0,
    failedRows: normalizedRows.length - validRows,
  };
  await job.save();

  return { job, normalizedRows, issues };
}

async function runMaybeTransaction<T>(fn: (session?: ClientSession) => Promise<T>) {
  const session = await mongoose.startSession();
  try {
    let output: T | undefined;
    await session.withTransaction(async () => {
      output = await fn(session);
    });
    return output as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.toLowerCase().includes("transaction")) throw error;
    return fn(undefined);
  } finally {
    await session.endSession();
  }
}

export async function executeImportJob(input: {
  importJobId: string;
  mapping: ImportMapping;
  actorId: string;
  actorRole: UserRole;
  parentTaskId: string;
  defaultAssigneeId: string;
  importValidRowsOnly: boolean;
  projectId?: string | null;
}) {
  const { job, normalizedRows } = await validateImportJob(input.importJobId, input.mapping);
  if (String(job.parentTaskId) !== input.parentTaskId) throw new Error("Import job does not belong to this task.");

  const rowsToImport = input.importValidRowsOnly
    ? normalizedRows.filter((row) => row.errors.length === 0)
    : normalizedRows;
  if (rowsToImport.some((row) => row.errors.length > 0)) {
    throw new Error("Fix validation errors or choose import valid rows only.");
  }
  for (const row of rowsToImport) {
    assertCanAssignSubtask(
      { userId: input.actorId, role: input.actorRole },
      row.assignedToUserId ?? input.defaultAssigneeId,
    );
  }

  const result = await runMaybeTransaction(async (session) => {
    const existingCount = await TaskModel.countDocuments({ parentTaskId: input.parentTaskId }).session(session ?? null);
    const idToSubtaskId = new Map<string, string>();
    const createdSubtaskIds: string[] = [];
    const dependencyIds: string[] = [];
    let importedRows = 0;
    let skippedRows = 0;

    for (const [index, row] of rowsToImport.entries()) {
      const existing = await TaskModel.findOne({
        parentTaskId: input.parentTaskId,
        importFingerprint: row.fingerprint,
      }).session(session ?? null);
      if (existing) {
        skippedRows += 1;
        if (row.externalId) idToSubtaskId.set(row.externalId, String(existing._id));
        continue;
      }

      const created = await TaskModel.create(
        [
          {
            code: await generateSubtaskCode(
              input.parentTaskId,
              row.externalId || `IMP-${String(job._id).slice(-6)}-${row.rowNumber}`,
              { session },
            ),
            title: row.title,
            description: row.description,
            status: row.status,
            priority: row.priority,
            assignedToUserId: row.assignedToUserId ?? input.defaultAssigneeId,
            createdBy: input.actorId,
            parentTaskId: input.parentTaskId,
            rootTaskId: input.parentTaskId,
            projectId: input.projectId || null,
            startAt: row.startAt,
            dueAt: row.dueAt,
            estimatedEffortHours: row.estimatedEffortHours,
            actualEffortHours: null,
            progressPercent: row.status === "COMPLETED" ? 100 : 0,
            completedAt: row.status === "COMPLETED" ? new Date() : null,
            tags: row.tags,
            stage: row.stage,
            order: existingCount + index,
            workflowTemplate: "custom",
            importJobId: job._id,
            importExternalId: row.externalId,
            importFingerprint: row.fingerprint,
          },
        ],
        { session },
      );
      const subtask = created[0];
      importedRows += 1;
      createdSubtaskIds.push(String(subtask._id));
      if (row.externalId) idToSubtaskId.set(row.externalId, String(subtask._id));
    }

    for (const row of rowsToImport) {
      const successorSubtaskId = row.externalId ? idToSubtaskId.get(row.externalId) : null;
      if (!successorSubtaskId) continue;
      for (const dependencyExternalId of row.dependsOn) {
        const predecessorSubtaskId = idToSubtaskId.get(dependencyExternalId);
        if (!predecessorSubtaskId) continue;
        try {
          const dependency = await createDependency(
            {
              parentTaskId: input.parentTaskId,
              predecessorSubtaskId,
              successorSubtaskId,
              dependencyType: "FINISH_TO_START",
            },
            { userId: input.actorId },
            { session },
          );
          dependencyIds.push(String(dependency._id));
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes("already exists")) throw error;
        }
      }
    }

    job.status = "imported";
    job.importedAt = new Date();
    job.createdSubtaskIds = createdSubtaskIds as unknown as typeof job.createdSubtaskIds;
    job.createdDependencyIds = dependencyIds as unknown as typeof job.createdDependencyIds;
    job.summary = {
      totalRows: normalizedRows.length,
      validRows: normalizedRows.filter((row) => row.errors.length === 0).length,
      warningCount: normalizedRows.reduce((count, row) => count + row.warnings.length, 0),
      errorCount: normalizedRows.reduce((count, row) => count + row.errors.length, 0),
      importedRows,
      failedRows: normalizedRows.length - rowsToImport.length,
    };
    await job.save({ session });

    return { importedRows, skippedRows, dependencyCount: dependencyIds.length, job };
  });

  await logActivity({
    action: "subtask_import_completed",
    actorId: input.actorId,
    entityType: "task",
    entityId: input.parentTaskId,
    details: {
      importJobId: String(job._id),
      importedRows: result.importedRows,
      skippedRows: result.skippedRows,
      dependencyCount: result.dependencyCount,
      fileName: job.fileName,
    },
  });

  return result;
}

export function summarizeValidation(normalizedRows: NormalizedImportRow[]) {
  const issues = normalizedRows.flatMap((row) => [...row.errors, ...row.warnings]);
  return {
    rows: normalizedRows.slice(0, 50),
    summary: {
      totalRows: normalizedRows.length,
      validRows: normalizedRows.filter((row) => row.errors.length === 0).length,
      warningCount: issues.filter((item) => item.level === "warning").length,
      errorCount: issues.filter((item) => item.level === "error").length,
      importedRows: 0,
      failedRows: normalizedRows.filter((row) => row.errors.length > 0).length,
    },
    issues,
  };
}

export { FIELD_LABELS };
