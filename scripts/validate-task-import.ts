/**
 * Validation for the spreadsheet import engine.
 *
 * The importer is the only part of Vega that parses untrusted, user-supplied files, so its
 * defences matter more than most code here: formula injection, oversized input, unknown
 * assignees, and dependency cycles expressed across spreadsheet rows.
 *
 * Pure logic and in-memory workbooks only - no database connection - so this runs anywhere.
 *
 * Run: npm run test:task-import
 */

import * as XLSX from "xlsx";
import {
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  autoMapHeaders,
  getImportTemplateHeaders,
  hasSpreadsheetFormulaRisk,
  parseSpreadsheet,
  resolveImportPriority,
  resolveImportStatus,
  summarizeValidation,
  validateDependencies,
} from "../src/lib/tasks/import-subtasks";

let failures = 0;

function check(label: string, condition: boolean) {
  if (!condition) {
    failures += 1;
    console.error(`  FAIL  ${label}`);
  }
}

function expectThrows(label: string, fn: () => unknown) {
  try {
    fn();
    failures += 1;
    console.error(`  FAIL  ${label} (expected a rejection, got none)`);
  } catch {
    // expected
  }
}

/** Build a real .xlsx buffer from a matrix, so the parser is exercised end to end. */
function workbookBuffer(matrix: unknown[][]): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(matrix);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// --- formula injection -----------------------------------------------------------------------
//
// Excel treats a leading =, +, - or @ as the start of a formula. A cell like
// =cmd|'/c calc'!A0 executes on open in vulnerable configurations, so these must never be stored
// and replayed back into an exported sheet.

check("rejects a leading equals", hasSpreadsheetFormulaRisk("=1+1"));
check("rejects a leading plus", hasSpreadsheetFormulaRisk("+1"));
check("rejects a leading minus", hasSpreadsheetFormulaRisk("-1"));
check("rejects a leading at", hasSpreadsheetFormulaRisk("@SUM(A1)"));
check("rejects the DDE command payload", hasSpreadsheetFormulaRisk("=cmd|'/c calc'!A0"));
check("rejects a formula behind leading whitespace", hasSpreadsheetFormulaRisk("   =1+1"));
check("rejects a formula behind a tab", hasSpreadsheetFormulaRisk("\t=1+1"));
check("allows ordinary text", !hasSpreadsheetFormulaRisk("Build the lead module"));
check("allows an interior equals", !hasSpreadsheetFormulaRisk("Rate = 40/hr"));
check("allows an empty string", !hasSpreadsheetFormulaRisk(""));

// --- status and priority aliases -------------------------------------------------------------

check("maps Done to COMPLETED", resolveImportStatus("Done") === "COMPLETED");
check("maps Complete to COMPLETED", resolveImportStatus("Complete") === "COMPLETED");
check("maps In Progress", resolveImportStatus("In Progress") === "IN_PROGRESS");
check("maps in_progress", resolveImportStatus("in_progress") === "IN_PROGRESS");
check("maps Not Started", resolveImportStatus("Not Started") === "NOT_STARTED");
check("maps the legacy todo value", resolveImportStatus("todo") === "NOT_STARTED");
check("maps Backlog to NOT_STARTED", resolveImportStatus("Backlog") === "NOT_STARTED");
// CLIENT_REVIEW joined the status set in Phase 1; the importer had not been taught it.
check("maps Client Review", resolveImportStatus("Client Review") === "CLIENT_REVIEW");
check("maps client_review", resolveImportStatus("client_review") === "CLIENT_REVIEW");
check("maps In Review to REVIEW", resolveImportStatus("In Review") === "REVIEW");
check("maps Canceled and Cancelled", resolveImportStatus("Canceled") === "CANCELLED");
check("rejects an unknown status", resolveImportStatus("Sort of done") === "");

check("maps Normal to MEDIUM", resolveImportPriority("Normal") === "MEDIUM");
check("maps Urgent", resolveImportPriority("urgent") === "URGENT");
check("maps High", resolveImportPriority("High") === "HIGH");
check("rejects an unknown priority", resolveImportPriority("Critical") === "");

// --- header auto-mapping ---------------------------------------------------------------------

const templateHeaders = getImportTemplateHeaders();
check("the template exposes headers", templateHeaders.length > 0);

const autoMapped = autoMapHeaders(templateHeaders);
check(
  "every template header auto-maps to a real field",
  templateHeaders.every((header) => autoMapped[header] && autoMapped[header] !== "ignore"),
);

const messyMap = autoMapHeaders(["Subtask Name", "Assignee Email", "Due Date", "Random Column"]);
check("maps a known header", messyMap["Subtask Name"] === "name");
check("maps assignee email", messyMap["Assignee Email"] === "assigneeEmail");
check("maps due date", messyMap["Due Date"] === "dueDate");
check("ignores an unrecognised header", messyMap["Random Column"] === "ignore");

// --- parsing ---------------------------------------------------------------------------------

const validBuffer = workbookBuffer([
  ["Subtask ID", "Subtask Name", "Priority", "Status", "Due Date"],
  ["A", "Design the schema", "High", "Not Started", "2026-09-10"],
  ["B", "Build the API", "Urgent", "In Progress", "2026-09-15"],
]);

const parsed = parseSpreadsheet(validBuffer, "plan.xlsx");
check("reports the file type", parsed.fileType === "xlsx");
check("hashes the file for idempotency", typeof parsed.fileHash === "string" && parsed.fileHash.length === 64);
check("reads every data row", parsed.rows.length === 2);
check("row numbers are 1-based including the header", parsed.rows[0].rowNumber === 2);
check("reads the headers", parsed.headers.length === 5);
check("returns an auto-mapping", parsed.mapping["Subtask Name"] === "name");
check("caps the preview", parsed.previewRows.length <= 50);

expectThrows("rejects an unsupported extension", () => parseSpreadsheet(validBuffer, "plan.pdf"));
expectThrows("rejects a file with no extension", () => parseSpreadsheet(validBuffer, "plan"));
expectThrows("rejects a malformed workbook", () =>
  parseSpreadsheet(Buffer.from("this is not a spreadsheet at all"), "plan.xlsx"),
);
expectThrows("rejects an empty header row", () =>
  parseSpreadsheet(workbookBuffer([["", "", ""], ["a", "b", "c"]]), "plan.xlsx"),
);
expectThrows("rejects an oversized file", () =>
  parseSpreadsheet(Buffer.alloc(MAX_IMPORT_FILE_BYTES + 1), "plan.xlsx"),
);

// Container signature must match the claimed extension. SheetJS is permissive enough to parse
// arbitrary bytes as a one-column sheet, which turned a corrupt upload into confusing row-level
// errors instead of one clear rejection.
expectThrows("rejects an empty file", () => parseSpreadsheet(Buffer.alloc(0), "plan.xlsx"));
expectThrows("rejects text wearing an .xlsx name", () =>
  parseSpreadsheet(Buffer.from("id,name" + String.fromCharCode(10) + "1,hello"), "plan.xlsx"),
);
expectThrows("rejects text wearing an .xls name", () =>
  parseSpreadsheet(Buffer.from("not a workbook"), "plan.xls"),
);
expectThrows("rejects binary wearing a .csv name", () =>
  parseSpreadsheet(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x1a, 0x0a]), "plan.csv"),
);
check(
  "still accepts real CSV text",
  parseSpreadsheet(Buffer.from("Subtask ID,Subtask Name" + String.fromCharCode(10) + "A,Real work"), "plan.csv").rows.length === 1,
);
check(
  "still accepts a real xlsx workbook",
  parseSpreadsheet(validBuffer, "plan.xlsx").rows.length === 2,
);

// Blank rows are skipped rather than becoming empty subtasks.
const withBlanks = parseSpreadsheet(
  workbookBuffer([
    ["Subtask ID", "Subtask Name"],
    ["A", "Real work"],
    ["", ""],
    ["B", "More real work"],
  ]),
  "plan.xlsx",
);
check("skips blank rows", withBlanks.rows.length === 2);

check("the row cap is enforced at a sane number", MAX_IMPORT_ROWS === 1000);

// --- dependency validation across rows ---------------------------------------------------------

type TestRow = Parameters<typeof validateDependencies>[0][number];

function row(externalId: string, dependsOn: string[], rowNumber = 2): TestRow {
  return {
    rowNumber,
    externalId,
    title: `Task ${externalId}`,
    description: "",
    assignedTo: "",
    assigneeEmail: "",
    assignedToUserId: null,
    priority: "MEDIUM",
    status: "NOT_STARTED",
    startAt: null,
    dueAt: null,
    estimatedEffortHours: null,
    dependsOn,
    stage: "",
    tags: [],
    fingerprint: `fp-${externalId}`,
    errors: [],
    warnings: [],
  } as unknown as TestRow;
}

function errorsFor(rows: TestRow[]) {
  validateDependencies(rows);
  return rows.flatMap((item) => item.errors.map((entry) => entry.message));
}

check(
  "flags a dependency that matches no row",
  errorsFor([row("A", ["GHOST"])]).some((message) => message.includes("does not match")),
);
check(
  "flags a self-dependency",
  errorsFor([row("A", ["A"])]).some((message) => message.includes("cannot depend on itself")),
);
check(
  "flags a two-row cycle",
  errorsFor([row("A", ["B"], 2), row("B", ["A"], 3)]).some((message) =>
    message.includes("Circular dependency"),
  ),
);
check(
  "flags a three-row cycle",
  errorsFor([row("A", ["C"], 2), row("B", ["A"], 3), row("C", ["B"], 4)]).some((message) =>
    message.includes("Circular dependency"),
  ),
);
check(
  "accepts a valid chain",
  errorsFor([row("A", [], 2), row("B", ["A"], 3), row("C", ["B"], 4)]).length === 0,
);
check(
  "accepts converging predecessors",
  errorsFor([row("FE", [], 2), row("BE", [], 3), row("INT", ["FE", "BE"], 4)]).length === 0,
);
check(
  "a row with no id and a dependency does not corrupt the graph",
  errorsFor([row("A", [], 2), row("", ["A"], 3)]).every(
    (message) => !message.includes("Circular dependency"),
  ),
);

// --- validation summary -------------------------------------------------------------------------

const summary = summarizeValidation([
  { ...row("A", []), errors: [], warnings: [] } as unknown as TestRow,
  {
    ...row("B", []),
    errors: [{ rowNumber: 3, level: "error", field: "name", message: "Subtask name is required." }],
    warnings: [],
  } as unknown as TestRow,
  {
    ...row("C", []),
    errors: [],
    warnings: [{ rowNumber: 4, level: "warning", field: "subtaskId", message: "Missing id." }],
  } as unknown as TestRow,
] as Parameters<typeof summarizeValidation>[0]);

check("counts every row", summary.summary.totalRows === 3);
check("counts error issues", summary.summary.errorCount === 1);
check("counts warning issues", summary.summary.warningCount === 1);
check("counts importable rows", summary.summary.validRows === 2);
check("counts failed rows", summary.summary.failedRows === 1);
check("collects every issue", summary.issues.length === 2);
check("caps the returned preview", summary.rows.length === 3);

console.log("");
if (failures > 0) {
  console.error(`Import validation FAILED with ${failures} problem(s).`);
  process.exitCode = 1;
} else {
  console.log("Import validation passed.");
}
