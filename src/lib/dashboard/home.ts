/* eslint-disable @typescript-eslint/no-explicit-any -- the models are untyped at the call site;
   only the aggregate() shape matters here and it is asserted on the rows below. */
import type { Model, PipelineStage } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { normalizeTaskStatus } from "@/lib/tasks/status";
import { serializeForJson } from "@/lib/utils/serialize";
import {
  ActivityLogModel,
  ClientModel,
  LeadModel,
  MeetingModel,
  TaskModel,
} from "@/models";

export type HomeStat = {
  key: "leads" | "clients" | "meetings" | "tasks";
  label: string;
  value: number;
  deltaPercent: number;
};

export type HomeSeriesPoint = { label: string; value: number };

export type HomeSlice = { label: string; value: number; percent: number };

export type HomeActivity = {
  id: string;
  title: string;
  detail: string;
  createdAt: string | null;
};

export type HomeMeeting = {
  id: string;
  title: string;
  day: string;
  month: string;
  timeRange: string;
  purpose: string;
};

export type HomeTask = {
  id: string;
  title: string;
  completed: boolean;
  priority: string;
};

export type HomeDashboardPayload = {
  rangeLabel: string;
  stats: HomeStat[];
  leadsOverview: HomeSeriesPoint[];
  clientGrowth: HomeSeriesPoint[];
  leadSources: HomeSlice[];
  taskStatus: HomeSlice[];
  totalLeadsInSources: number;
  totalTasksInStatus: number;
  recentActivity: HomeActivity[];
  upcomingMeetings: HomeMeeting[];
  todaysTasks: HomeTask[];
  todaysTasksCompleted: number;
};

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const LEAD_SOURCE_LABEL: Record<string, string> = {
  website: "Website",
  referral: "Referral",
  cold_outreach: "Cold Outreach",
  paid_ads: "Paid Ads",
  event: "Event",
  partner: "Partner",
  other: "Others",
};

const ACTIVITY_TITLE: Record<string, string> = {
  lead_created: "New lead captured",
  lead_status_changed: "Lead status updated",
  lead_follow_up_completed: "Lead follow-up completed",
  task_created: "New task created",
  task_assigned: "Task assigned",
  task_status_changed: "Task status updated",
  task_completed: "Task completed",
  subtask_completed: "Subtask completed",
  meeting_created: "Meeting scheduled",
  meeting_cancelled: "Meeting cancelled",
  query_created: "New query received",
  proposal_signed: "Client signed proposal",
  workflow_changed: "Workflow updated",
};

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Percentage change against the previous window, guarding the divide-by-zero start-up case. */
function deltaPercent(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/** The first instant of the month `back` months before `from`, in local time. */
function monthStart(from: Date, back = 0) {
  return new Date(from.getFullYear(), from.getMonth() - back, 1);
}

function percentOf(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

/**
 * Counts documents per month for the last six months.
 *
 * One aggregation per collection rather than six count queries: the dashboard is the first
 * screen every admin loads, so it should not fan out into a dozen round trips.
 */
async function monthlySeries(
  model: Model<any>,
  since: Date,
  match: Record<string, unknown> = {},
) {
  const rows: Array<{ _id: { year: number; month: number }; count: number }> = await model.aggregate([
    { $match: { ...match, createdAt: { $gte: since } } },
    {
      $group: {
        _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
  ] as PipelineStage[]);

  const byKey = new Map(rows.map((row) => [`${row._id.year}-${row._id.month}`, row.count]));
  const now = new Date();

  return Array.from({ length: 6 }, (_, index) => {
    const date = monthStart(now, 5 - index);
    return {
      label: MONTH_SHORT[date.getMonth()],
      value: byKey.get(`${date.getFullYear()}-${date.getMonth() + 1}`) ?? 0,
    };
  });
}

export async function getHomeDashboard(): Promise<HomeDashboardPayload> {
  await connectToDatabase();

  const now = new Date();
  const thisMonthStart = monthStart(now);
  const lastMonthStart = monthStart(now, 1);
  const sixMonthsAgo = monthStart(now, 5);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const thisMonth = { createdAt: { $gte: thisMonthStart } };
  const lastMonth = { createdAt: { $gte: lastMonthStart, $lt: thisMonthStart } };

  const [
    totalLeads,
    leadsThisMonth,
    leadsLastMonth,
    totalClients,
    clientsThisMonth,
    clientsLastMonth,
    meetingsThisMonth,
    meetingsLastMonth,
    openTasks,
    tasksThisMonth,
    tasksLastMonth,
  ] = await Promise.all([
    LeadModel.countDocuments({}),
    LeadModel.countDocuments(thisMonth),
    LeadModel.countDocuments(lastMonth),
    ClientModel.countDocuments({}),
    ClientModel.countDocuments(thisMonth),
    ClientModel.countDocuments(lastMonth),
    MeetingModel.countDocuments({ status: "confirmed", startAt: { $gte: thisMonthStart } }),
    MeetingModel.countDocuments({ status: "confirmed", startAt: { $gte: lastMonthStart, $lt: thisMonthStart } }),
    TaskModel.countDocuments({ parentTaskId: null, archivedAt: null }),
    TaskModel.countDocuments({ parentTaskId: null, archivedAt: null, ...thisMonth }),
    TaskModel.countDocuments({ parentTaskId: null, archivedAt: null, ...lastMonth }),
  ]);

  const [leadsOverview, clientGrowth, sourceRows, statusRows, activityLogs, meetings, todaysTaskRows] =
    await Promise.all([
      monthlySeries(LeadModel, sixMonthsAgo),
      monthlySeries(ClientModel, sixMonthsAgo),
      LeadModel.aggregate([{ $group: { _id: "$source", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      TaskModel.aggregate([
        { $match: { parentTaskId: null, archivedAt: null } },
        { $group: { _id: { status: "$status", overdue: { $and: [{ $ne: ["$dueAt", null] }, { $lt: ["$dueAt", now] }] } }, count: { $sum: 1 } } },
      ]),
      ActivityLogModel.find({}).sort({ createdAt: -1 }).limit(5).select("action entityType createdAt").lean(),
      MeetingModel.find({ status: "confirmed", startAt: { $gte: now } })
        .sort({ startAt: 1 })
        .limit(4)
        .select("title contactName purpose startAt durationMinutes")
        .lean(),
      TaskModel.find({ parentTaskId: null, archivedAt: null, dueAt: { $gte: todayStart, $lt: todayEnd } })
        .sort({ priority: -1, dueAt: 1 })
        .limit(5)
        .select("title status priority")
        .lean(),
    ]);

  const sourceTotal = sourceRows.reduce((total: number, row: { count: number }) => total + row.count, 0);
  const leadSources: HomeSlice[] = sourceRows.map((row: { _id: string; count: number }) => ({
    label: LEAD_SOURCE_LABEL[row._id] ?? titleCase(row._id ?? "other"),
    value: row.count,
    percent: percentOf(row.count, sourceTotal),
  }));

  // Overdue is a derived bucket, not a stored status, so it is counted first and the remaining
  // rows fall through to their normalised status.
  const buckets = { Completed: 0, "In Progress": 0, Pending: 0, Overdue: 0 };
  for (const row of statusRows as Array<{ _id: { status: string; overdue: boolean }; count: number }>) {
    const status = normalizeTaskStatus(row._id.status);
    if (status === "COMPLETED") buckets.Completed += row.count;
    else if (row._id.overdue) buckets.Overdue += row.count;
    else if (["IN_PROGRESS", "REVIEW", "CLIENT_REVIEW"].includes(status)) buckets["In Progress"] += row.count;
    else buckets.Pending += row.count;
  }
  const statusTotal = Object.values(buckets).reduce((total, value) => total + value, 0);
  const taskStatus: HomeSlice[] = Object.entries(buckets).map(([label, value]) => ({
    label,
    value,
    percent: percentOf(value, statusTotal),
  }));

  const stats: HomeStat[] = [
    { key: "leads", label: "Total Leads", value: totalLeads, deltaPercent: deltaPercent(leadsThisMonth, leadsLastMonth) },
    { key: "clients", label: "Active Clients", value: totalClients, deltaPercent: deltaPercent(clientsThisMonth, clientsLastMonth) },
    { key: "meetings", label: "Meetings", value: meetingsThisMonth, deltaPercent: deltaPercent(meetingsThisMonth, meetingsLastMonth) },
    { key: "tasks", label: "Tasks", value: openTasks, deltaPercent: deltaPercent(tasksThisMonth, tasksLastMonth) },
  ];

  const timeFormat = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  const upcomingMeetings: HomeMeeting[] = meetings.map((meeting) => {
    const start = new Date(meeting.startAt);
    const end = new Date(start.getTime() + (meeting.durationMinutes ?? 30) * 60 * 1000);
    return {
      id: String(meeting._id),
      title: meeting.title || meeting.contactName || "Meeting",
      day: String(start.getDate()).padStart(2, "0"),
      month: MONTH_SHORT[start.getMonth()].toUpperCase(),
      timeRange: `${timeFormat.format(start)} - ${timeFormat.format(end)}`,
      purpose: meeting.purpose ? titleCase(meeting.purpose) : "Meeting",
    };
  });

  const todaysTasks: HomeTask[] = todaysTaskRows.map((task) => ({
    id: String(task._id),
    title: task.title,
    completed: normalizeTaskStatus(task.status) === "COMPLETED",
    priority: titleCase(task.priority ?? "medium"),
  }));

  const rangeFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return serializeForJson({
    rangeLabel: `${rangeFormat.format(thisMonthStart)} - ${rangeFormat.format(new Date(monthStart(now, -1).getTime() - 1))}`,
    stats,
    leadsOverview,
    clientGrowth,
    leadSources,
    taskStatus,
    totalLeadsInSources: sourceTotal,
    totalTasksInStatus: statusTotal,
    recentActivity: activityLogs.map((log) => ({
      id: String(log._id),
      title: ACTIVITY_TITLE[log.action] ?? titleCase(log.action),
      detail: titleCase(log.entityType ?? ""),
      createdAt: log.createdAt ?? null,
    })),
    upcomingMeetings,
    todaysTasks,
    todaysTasksCompleted: todaysTasks.filter((task) => task.completed).length,
  }) as HomeDashboardPayload;
}
