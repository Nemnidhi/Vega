import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { MAX_IMPORT_FILE_BYTES, parseSpreadsheet } from "@/lib/tasks/import-subtasks";
import { assertCanAccessTask } from "@/lib/tasks/subtasks";
import { objectIdSchema } from "@/lib/validation/common";
import { ImportJobModel, TaskModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

async function getParentTask(parentTaskId: string) {
  const parent = await TaskModel.findById(parentTaskId).select("assignedToUserId createdBy").lean();
  if (!parent) throw new Error("Task not found.");
  return parent;
}

export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { id } = await params;
    const parentTaskId = objectIdSchema.parse(id);

    const parent = await getParentTask(parentTaskId);
    await assertCanAccessTask(actor, parent);

    const jobs = await ImportJobModel.find({ parentTaskId })
      .select("-rows")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return ok(serializeForJson(jobs));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { id } = await params;
    const parentTaskId = objectIdSchema.parse(id);

    const parent = await getParentTask(parentTaskId);
    await assertCanAccessTask(actor, parent);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof Blob)) {
      return fail("Upload an .xlsx, .xls, or .csv file.", 422);
    }
    const fileName = typeof (file as File).name === "string" ? (file as File).name : "";
    if (!fileName) {
      return fail("Upload an .xlsx, .xls, or .csv file.", 422);
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      return fail("Import file is too large. Maximum size is 5 MB.", 413);
    }

    const parsed = parseSpreadsheet(Buffer.from(await file.arrayBuffer()), fileName);
    const job = await ImportJobModel.create({
      parentTaskId,
      fileName,
      fileType: parsed.fileType,
      fileHash: parsed.fileHash,
      status: "previewed",
      headers: parsed.headers,
      rows: parsed.rows,
      mapping: parsed.mapping,
      summary: {
        totalRows: parsed.rows.length,
        validRows: 0,
        warningCount: 0,
        errorCount: 0,
        importedRows: 0,
        failedRows: 0,
      },
      createdBy: actor.userId,
    });

    return ok(
      serializeForJson({
        importJobId: String(job._id),
        fileName: job.fileName,
        fileType: job.fileType,
        fileHash: job.fileHash,
        headers: parsed.headers,
        previewRows: parsed.previewRows,
        mapping: parsed.mapping,
        summary: job.summary,
      }),
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
