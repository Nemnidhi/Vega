import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  autoMapHeaders,
  getImportTemplateHeaders,
  hasSpreadsheetFormulaRisk,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  parseSpreadsheet,
} from "../src/lib/tasks/import-subtasks";
import {
  bulkAssignSubtasksSchema,
  bulkUpdateSubtasksSchema,
  createSubtaskDependencySchema,
  createAdvancedSubtaskSchema,
  reorderSubtasksSchema,
  rescheduleSubtaskSchema,
  taskAiAssistantSchema,
  taskAnalyticsFiltersSchema,
  updateAdvancedSubtaskSchema,
  updateWorkflowLayoutSchema,
} from "../src/lib/validation/task";
import { ActivityLogModel, NotificationModel } from "../src/models";

const objectId = "64f0c2dd7f1a4a44b9c8d221";

const created = createAdvancedSubtaskSchema.parse({
  title: "Requirement Gathering",
  description: "Collect scope and acceptance notes.",
  assignedToUserId: objectId,
  status: "READY",
  priority: "HIGH",
  startAt: "2026-08-26",
  dueAt: "2026-08-28",
  estimatedEffortHours: 4,
  actualEffortHours: 1.5,
  progressPercent: 25,
  tags: ["scope", "client"],
  stage: "Discovery",
  attachments: [{ name: "Brief", url: "https://example.com/brief.pdf" }],
  comments: [{ body: "Kickoff notes captured." }],
  checklist: [{ title: "Confirm point of contact", completed: false }],
  workflowNodeType: "APPROVAL",
  workflowGroup: "APPROVAL",
  workflowDecision: "approved",
});

assert.equal(created.status, "READY");
assert.equal(created.priority, "HIGH");
assert.equal(created.progressPercent, 25);
assert.equal(created.workflowNodeType, "APPROVAL");
assert.equal(created.workflowGroup, "APPROVAL");
assert.equal(created.workflowDecision, "APPROVED");

const defaults = createAdvancedSubtaskSchema.parse({
  title: "UI Design",
});

assert.equal(defaults.status, "NOT_STARTED");
assert.equal(defaults.priority, "MEDIUM");
assert.equal(defaults.progressPercent, 0);

assert.throws(() =>
  createAdvancedSubtaskSchema.parse({
    title: "Bad progress",
    progressPercent: 101,
  }),
);

assert.doesNotThrow(() =>
  updateAdvancedSubtaskSchema.parse({
    status: "BLOCKED",
    priority: "URGENT",
    progressPercent: 80,
  }),
);

assert.doesNotThrow(() =>
  reorderSubtasksSchema.parse({
    subtasks: [
      { id: objectId, order: 1 },
      { id: "64f0c2dd7f1a4a44b9c8d222", order: 0 },
    ],
  }),
);

assert.doesNotThrow(() =>
  bulkUpdateSubtasksSchema.parse({
    subtaskIds: [objectId],
    patch: { status: "REVIEW", priority: "MEDIUM" },
  }),
);

assert.doesNotThrow(() =>
  bulkAssignSubtasksSchema.parse({
    subtaskIds: [objectId],
    assignedToUserId: "64f0c2dd7f1a4a44b9c8d223",
  }),
);

const dependency = createSubtaskDependencySchema.parse({
  predecessorSubtaskId: objectId,
  successorSubtaskId: "64f0c2dd7f1a4a44b9c8d224",
  branchKey: "yes",
  branchLabel: "YES",
});

assert.equal(dependency.dependencyType, "FINISH_TO_START");
assert.equal(dependency.branchKey, "YES");
assert.equal(dependency.branchLabel, "YES");

assert.throws(() =>
  createSubtaskDependencySchema.parse({
    predecessorSubtaskId: objectId,
    successorSubtaskId: "64f0c2dd7f1a4a44b9c8d224",
    dependencyType: "INVALID",
  }),
);

const workflowLayout = updateWorkflowLayoutSchema.parse({
  nodes: [
    {
      id: objectId,
      positionX: 120.4,
      positionY: 280.8,
      width: 280,
      collapsed: false,
      group: "Discovery",
    },
  ],
  stages: [
    {
      key: "DISCOVERY",
      name: "Discovery",
      color: "accent",
      collapsed: false,
      order: 0,
    },
  ],
});

assert.equal(workflowLayout.nodes[0]?.positionX, 120.4);
assert.equal(workflowLayout.nodes[0]?.group, "Discovery");
assert.equal(workflowLayout.stages?.[0]?.key, "DISCOVERY");

const stageOnlyLayout = updateWorkflowLayoutSchema.parse({
  nodes: [],
  stages: [
    {
      key: "QA",
      name: "QA",
      color: "success",
      collapsed: true,
      order: 0,
    },
  ],
});

assert.equal(stageOnlyLayout.nodes.length, 0);
assert.equal(stageOnlyLayout.stages?.[0]?.collapsed, true);

assert.throws(() =>
  updateWorkflowLayoutSchema.parse({
    nodes: [{ id: objectId, positionX: 0, positionY: 0, width: 900 }],
  }),
);

const templateHeaders = getImportTemplateHeaders();
assert.ok(templateHeaders.includes("Subtask Name"));
assert.equal(autoMapHeaders(["Task Name", "Owner Email", "Deadline", "Depends On"])["Task Name"], "name");
assert.equal(autoMapHeaders(["Task Name", "Owner Email", "Deadline", "Depends On"])["Owner Email"], "assigneeEmail");

const importCsv = Buffer.from(
  [
    "Subtask ID,Subtask Name,Priority,Status,Depends On",
    "ST-001,Requirement Gathering,HIGH,NOT_STARTED,",
    "ST-002,UI Design,MEDIUM,READY,ST-001",
  ].join("\n"),
);
const parsedImport = parseSpreadsheet(importCsv, "subtasks.csv");
assert.equal(parsedImport.fileType, "csv");
assert.equal(parsedImport.rows.length, 2);
assert.equal(parsedImport.mapping["Subtask Name"], "name");

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  workbook,
  XLSX.utils.aoa_to_sheet([
    ["Subtask Name", "Priority"],
    ["Frontend Development", "HIGH"],
  ]),
  "Subtasks",
);
const workbookBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
assert.equal(parseSpreadsheet(workbookBuffer, "subtasks.xlsx").rows.length, 1);

assert.equal(hasSpreadsheetFormulaRisk("=cmd|' /C calc'!A0"), true);
assert.equal(hasSpreadsheetFormulaRisk("@SUM(A1:A2)"), true);
assert.equal(hasSpreadsheetFormulaRisk("Requirement Gathering"), false);
assert.throws(() => parseSpreadsheet(Buffer.alloc(MAX_IMPORT_FILE_BYTES + 1), "oversized.csv"), /too large/i);

const tooManyRowsCsv = Buffer.from(
  ["Subtask Name", ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, index) => `Row ${index + 1}`)].join("\n"),
);
assert.throws(() => parseSpreadsheet(tooManyRowsCsv, "too-many.csv"), /too many rows/i);

const reschedule = rescheduleSubtaskSchema.parse({
  startAt: "2026-08-27",
  dueAt: "2026-08-31",
  shiftDependents: true,
});

assert.equal(reschedule.shiftDependents, true);
assert.throws(() => rescheduleSubtaskSchema.parse({ shiftDependents: false }));

assert.doesNotThrow(() =>
  taskAiAssistantSchema.parse({
    mode: "generate_workflow",
    prompt: "Build a real estate CRM",
  }),
);

assert.doesNotThrow(() =>
  taskAiAssistantSchema.parse({
    mode: "break_down_subtask",
    subtaskId: objectId,
  }),
);

assert.throws(() =>
  taskAiAssistantSchema.parse({
    mode: "autonomous_execute",
  }),
);

assert.doesNotThrow(() =>
  taskAnalyticsFiltersSchema.parse({
    projectId: objectId,
    userId: "64f0c2dd7f1a4a44b9c8d223",
    status: "BLOCKED",
    priority: "URGENT",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    stage: "QA",
  }),
);

assert.throws(() =>
  taskAnalyticsFiltersSchema.parse({
    startDate: "2026-09-01",
    endDate: "2026-08-01",
  }),
);

const activityActions = ActivityLogModel.schema.path("action").options.enum as string[];
const notificationTypes = NotificationModel.schema.path("type").options.enum as string[];

[
  "subtask_assigned",
  "subtask_reassigned",
  "subtask_ready",
  "subtask_blocked",
  "subtask_completed",
  "subtask_comment_mention",
  "approval_requested",
  "approval_accepted",
  "approval_rejected",
  "workflow_changed",
].forEach((action) => assert.ok(activityActions.includes(action), `Missing activity action ${action}`));

[
  "subtask_assigned",
  "subtask_reassigned",
  "subtask_ready",
  "dependency_completed",
  "subtask_blocked",
  "due_date_approaching",
  "subtask_overdue",
  "comment_mention",
  "approval_requested",
  "approval_accepted",
  "approval_rejected",
  "workflow_changed",
].forEach((type) => assert.ok(notificationTypes.includes(type), `Missing notification type ${type}`));

console.log("Subtask schema validation passed.");
