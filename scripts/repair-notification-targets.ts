/**
 * One-off repair for data that predates the staff-only assignment rule and the
 * follow-up hand-off on lead transfer.
 *
 * Three problems, all of which show up as a notification that 404s when tapped:
 *
 *  1. Tasks assigned to client accounts. The assignee dropdown used to list
 *     clients, so real tasks were assigned to customers who cannot open the
 *     tasks area at all.
 *  2. Open follow-ups assigned to someone who is not the lead's owner. A
 *     rebalance or transfer moved the lead and left the follow-up behind; a
 *     sales rep cannot open a lead they no longer own.
 *  3. Notifications already sent for either of the above.
 *
 * Dry-run unless --apply is passed.
 */
import mongoose from "mongoose";
import { LeadFollowUpModel, LeadModel, NotificationModel, TaskModel, UserModel } from "@/models";
import { TASK_ASSIGNABLE_ROLES } from "@/lib/tasks/subtasks";

const apply = process.argv.includes("--apply");

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);
  console.log(apply ? "APPLYING CHANGES\n" : "DRY RUN - pass --apply to make changes\n");

  // ---- 1. tasks held by client accounts
  const staff = await UserModel.find({ role: { $in: TASK_ASSIGNABLE_ROLES }, status: "active" })
    .select("_id").lean();
  const staffIds = new Set(staff.map((user) => String(user._id)));

  const assignedTasks = await TaskModel.find({ assignedToUserId: { $ne: null } })
    .select("title code assignedToUserId createdBy").lean();
  const badTasks = assignedTasks.filter((task) => !staffIds.has(String(task.assignedToUserId)));

  console.log(`tasks assigned to non-staff: ${badTasks.length}`);
  for (const task of badTasks) {
    // Hand it back to whoever created it, if they are staff; otherwise unassign
    // rather than guess, so it surfaces as unassigned instead of silently owned
    // by someone who cannot see it.
    const fallback = staffIds.has(String(task.createdBy)) ? task.createdBy : null;
    console.log(`  "${task.title}" -> ${fallback ? "creator" : "unassigned"}`);
    if (apply) {
      await TaskModel.updateOne({ _id: task._id }, { $set: { assignedToUserId: fallback } });
    }
  }

  // ---- 2. follow-ups stranded on a lead their assignee no longer owns
  const openFollowUps = await LeadFollowUpModel.find({ status: "scheduled", assignedToUserId: { $ne: null } })
    .select("leadId assignedToUserId nextAction").lean();
  const leads = await LeadModel.find({ _id: { $in: openFollowUps.map((f) => f.leadId) } })
    .select("ownerId title").lean();
  const leadById = new Map(leads.map((lead) => [String(lead._id), lead]));

  let stranded = 0;
  let unfixable = 0;
  for (const followUp of openFollowUps) {
    const lead = leadById.get(String(followUp.leadId));
    if (!lead) continue;
    if (String(lead.ownerId ?? "") === String(followUp.assignedToUserId)) continue;
    if (!lead.ownerId) {
      unfixable += 1;
      console.log(`  follow-up on unowned lead "${lead.title}" - left alone, assign the lead first`);
      continue;
    }
    stranded += 1;
    console.log(`  follow-up on "${lead.title}" -> lead owner`);
    if (apply) {
      await LeadFollowUpModel.updateOne({ _id: followUp._id }, { $set: { assignedToUserId: lead.ownerId } });
    }
  }
  console.log(`follow-ups handed to the lead owner: ${stranded}${unfixable ? ` (${unfixable} on unowned leads, skipped)` : ""}`);

  // ---- 3. notifications whose target the recipient cannot open
  const notifications = await NotificationModel.find({}).select("recipientUserId entityType entityId").lean();
  const users = await UserModel.find({}).select("_id role").lean();
  const roleById = new Map(users.map((user) => [String(user._id), user.role as string]));
  const leadOwners = new Map(
    (await LeadModel.find({}).select("_id ownerId").lean()).map((l) => [String(l._id), String(l.ownerId ?? "")]),
  );

  const dead: unknown[] = [];
  for (const note of notifications) {
    const role = roleById.get(String(note.recipientUserId));
    if (!role) { dead.push(note._id); continue; }
    if (note.entityType === "lead") {
      if (role === "sales" && leadOwners.get(String(note.entityId)) !== String(note.recipientUserId)) {
        dead.push(note._id);
      }
    } else if (!TASK_ASSIGNABLE_ROLES.includes(role as never)) {
      dead.push(note._id);
    }
  }
  console.log(`\nnotifications pointing somewhere the recipient cannot open: ${dead.length}`);
  if (apply && dead.length) {
    await NotificationModel.deleteMany({ _id: { $in: dead } });
    console.log("  removed");
  }

  await mongoose.disconnect();
  console.log("\ndone");
}

main().catch(async (error) => {
  console.error(error);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
