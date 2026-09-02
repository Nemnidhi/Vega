import * as XLSX from "xlsx";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { fail, handleApiError } from "@/lib/api/responses";
import { getImportTemplateHeaders } from "@/lib/tasks/import-subtasks";
import { assertCanAccessTask } from "@/lib/tasks/subtasks";
import { objectIdSchema } from "@/lib/validation/common";
import { TaskModel } from "@/models";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { id } = await params;
    const parentTaskId = objectIdSchema.parse(id);

    const parent = await TaskModel.findById(parentTaskId).select("assignedToUserId createdBy").lean();
    if (!parent) return fail("Task not found.", 404);
    await assertCanAccessTask(actor, parent);

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      getImportTemplateHeaders(),
      [
        "ST-001",
        "Requirement Gathering",
        "Collect project requirements and acceptance criteria.",
        "",
        "",
        "HIGH",
        "NOT_STARTED",
        "2026-09-01",
        "2026-09-03",
        "8",
        "",
        "PLANNING",
        "discovery,client",
      ],
      [
        "ST-002",
        "UI Design",
        "Prepare wireframes and key screens.",
        "",
        "",
        "MEDIUM",
        "NOT_STARTED",
        "2026-09-04",
        "2026-09-08",
        "16",
        "ST-001",
        "DESIGN",
        "design",
      ],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Subtasks");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="subtask-import-template.xlsx"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
