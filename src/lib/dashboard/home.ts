/* eslint-disable @typescript-eslint/no-explicit-any -- the models are untyped at the call site;
   only the aggregate() shape matters here and it is asserted on the rows below. */
import type { PipelineStage } from "mongoose";
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

type DashboardCountRow = { total: number; thisMonth: number; lastMonth: number };
type MonthlyRow = { _id: { year: number; month: number }; count: number };
type SourceRow = { _id: string | null; count: number };
type StatusRow = { _id: { status: string; overdue: boolean }; count: number };
type MeetingRow = {
  _id: unknown;
  title?: string;
  contactName?: string;
  purpose?: string;
  startAt: Date | string;
  durationMinutes?: number;
};
type TaskRow = {
  _id: unknown;
  title: string;
  status: string;
  priority?: string;
};
type LeadSummary = { counts: DashboardCountRow[]; monthly: MonthlyRow[]; sources: SourceRow[] };
type ClientSummary = { counts: DashboardCountRow[]; monthly: MonthlyRow[] };
type TaskSummary = { counts: DashboardCountRow[]; statuses: StatusRow[]; today: TaskRow[] };
type MeetingSummary = { counts: Array<Omit<DashboardCountRow, "total">>; upcoming: MeetingRow[] };

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
 * Maps a compact monthly aggregation back onto the six fixed labels the dashboard renders.
 */
function monthlySeriesFromRows(
  rows: MonthlyRow[],
  now: Date,
) {
  const byKey = new Map(rows.map((row) => [`${row._id.year}-${row._id.month}`, row.count]));

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

  const [leadSummary, clientSummary, taskSummary, meetingSummary, activityLogs] =
    await Promise.all([
      LeadModel.aggregate([
        {
          $facet: {
            counts: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  thisMonth: { $sum: { $cond: [{ $gte: ["$createdAt", thisMonthStart] }, 1, 0] } },
                  lastMonth: {
                    $sum: {
                      $cond: [
                        { $and: [{ $gte: ["$createdAt", lastMonthStart] }, { $lt: ["$createdAt", thisMonthStart] }] },
                        1,
                        0,
                      ],
                    },
                  },
                },
              },
            ],
            monthly: [
              { $match: { createdAt: { $gte: sixMonthsAgo } } },
              { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
            ],
            sources: [
              { $group: { _id: "$source", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
            ],
          },
        },
      ] as PipelineStage[]),
      ClientModel.aggregate([
        {
          $facet: {
            counts: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  thisMonth: { $sum: { $cond: [{ $gte: ["$createdAt", thisMonthStart] }, 1, 0] } },
                  lastMonth: {
                    $sum: {
                      $cond: [
                        { $and: [{ $gte: ["$createdAt", lastMonthStart] }, { $lt: ["$createdAt", thisMonthStart] }] },
                        1,
                        0,
                      ],
                    },
                  },
                },
              },
            ],
            monthly: [
              { $match: { createdAt: { $gte: sixMonthsAgo } } },
              { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
            ],
          },
        },
      ] as PipelineStage[]),
      TaskModel.aggregate([
        {
          $match: {
            parentTaskId: null,
            archivedAt: null,
          },
        },
        {
          $facet: {
            counts: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  thisMonth: { $sum: { $cond: [{ $gte: ["$createdAt", thisMonthStart] }, 1, 0] } },
                  lastMonth: {
                    $sum: {
                      $cond: [
                        { $and: [{ $gte: ["$createdAt", lastMonthStart] }, { $lt: ["$createdAt", thisMonthStart] }] },
                        1,
                        0,
                      ],
                    },
                  },
                },
              },
            ],
            statuses: [
              {
                $group: {
                  _id: { status: "$status", overdue: { $and: [{ $ne: ["$dueAt", null] }, { $lt: ["$dueAt", now] }] } },
                  count: { $sum: 1 },
                },
              },
            ],
            today: [
              { $match: { dueAt: { $gte: todayStart, $lt: todayEnd } } },
              { $sort: { priority: -1, dueAt: 1 } },
              { $limit: 5 },
              { $project: { title: 1, status: 1, priority: 1 } },
            ],
          },
        },
      ] as PipelineStage[]),
      MeetingModel.aggregate([
        {
          $match: {
            status: "confirmed",
            startAt: { $gte: lastMonthStart },
          },
        },
        {
          $facet: {
            counts: [
              {
                $group: {
                  _id: null,
                  thisMonth: { $sum: { $cond: [{ $gte: ["$startAt", thisMonthStart] }, 1, 0] } },
                  lastMonth: {
                    $sum: {
                      $cond: [
                        { $and: [{ $gte: ["$startAt", lastMonthStart] }, { $lt: ["$startAt", thisMonthStart] }] },
                        1,
                        0,
                      ],
                    },
                  },
                },
              },
            ],
            upcoming: [
              { $match: { startAt: { $gte: now } } },
              { $sort: { startAt: 1 } },
              { $limit: 4 },
              { $project: { title: 1, contactName: 1, purpose: 1, startAt: 1, durationMinutes: 1 } },
            ],
          },
        },
      ] as PipelineStage[]),
      ActivityLogModel.find({}).sort({ createdAt: -1 }).limit(5).select("action entityType createdAt").lean(),
    ]);

  const leadResult = (leadSummary[0] ?? { counts: [], monthly: [], sources: [] }) as LeadSummary;
  const clientResult = (clientSummary[0] ?? { counts: [], monthly: [] }) as ClientSummary;
  const taskResult = (taskSummary[0] ?? { counts: [], statuses: [], today: [] }) as TaskSummary;
  const meetingResult = (meetingSummary[0] ?? { counts: [], upcoming: [] }) as MeetingSummary;

  const leadCounts = leadResult.counts[0] ?? { total: 0, thisMonth: 0, lastMonth: 0 };
  const clientCounts = clientResult.counts[0] ?? { total: 0, thisMonth: 0, lastMonth: 0 };
  const taskCounts = taskResult.counts[0] ?? { total: 0, thisMonth: 0, lastMonth: 0 };
  const meetingCounts = meetingResult.counts[0] ?? { thisMonth: 0, lastMonth: 0 };
  const leadsOverview = monthlySeriesFromRows(leadResult.monthly, now);
  const clientGrowth = monthlySeriesFromRows(clientResult.monthly, now);
  const sourceRows = leadResult.sources;
  const statusRows = taskResult.statuses;
  const meetings = meetingResult.upcoming;
  const todaysTaskRows = taskResult.today;

  const sourceTotal = sourceRows.reduce((total, row) => total + row.count, 0);
  const leadSources: HomeSlice[] = sourceRows.map((row) => ({
    label: LEAD_SOURCE_LABEL[row._id ?? "other"] ?? titleCase(row._id ?? "other"),
    value: row.count,
    percent: percentOf(row.count, sourceTotal),
  }));

  // Overdue is a derived bucket, not a stored status, so it is counted first and the remaining
  // rows fall through to their normalised status.
  const buckets = { Completed: 0, "In Progress": 0, Pending: 0, Overdue: 0 };
  for (const row of statusRows) {
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
    { key: "leads", label: "Total Leads", value: leadCounts.total, deltaPercent: deltaPercent(leadCounts.thisMonth, leadCounts.lastMonth) },
    { key: "clients", label: "Active Clients", value: clientCounts.total, deltaPercent: deltaPercent(clientCounts.thisMonth, clientCounts.lastMonth) },
    { key: "meetings", label: "Meetings", value: meetingCounts.thisMonth, deltaPercent: deltaPercent(meetingCounts.thisMonth, meetingCounts.lastMonth) },
    { key: "tasks", label: "Tasks", value: taskCounts.total, deltaPercent: deltaPercent(taskCounts.thisMonth, taskCounts.lastMonth) },
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
