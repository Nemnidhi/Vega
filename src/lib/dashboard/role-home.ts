import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import {
  AttendanceModel,
  LeadFollowUpModel,
  LeadModel,
  MeetingModel,
  SalesTargetModel,
  TaskModel,
} from "@/models";
import { closedDealProgress } from "@/lib/sales-targets/progress";
import { getAttendanceMonthKey } from "@/lib/attendance/date";
import { isClosedStatus, normalizeTaskStatus } from "@/lib/tasks/status";
import type { UserRole } from "@/types/user";

/**
 * Role dashboards.
 *
 * The one dashboard that existed answered a business-owner's questions - leads
 * this month, client growth, pipeline by source - and everyone who was not an
 * owner got either that or, for developers, a redirect to the task list. This
 * builds the figures each role actually opens the app to check, so the page can
 * show a developer their own workload rather than the company's revenue.
 */

export type RoleMetric = {
  key: string;
  label: string;
  value: string;
  hint?: string;
  tone: "blue" | "green" | "amber" | "violet" | "red" | "cyan";
};

export type RoleListItem = {
  id: string;
  title: string;
  detail: string;
  meta?: string;
  href: string;
  tone?: "default" | "danger" | "warning";
};

export type RoleProgress = {
  label: string;
  achieved: number;
  target: number;
  display: string;
};

export type RoleDashboard = {
  headline: string;
  metrics: RoleMetric[];
  progress: RoleProgress[];
  lists: Array<{ title: string; emptyText: string; href: string; items: RoleListItem[] }>;
};

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function hoursAndMinutes(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  return `${Math.floor(safe / 60)}h ${String(safe % 60).padStart(2, "0")}m`;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

/** Open tasks assigned to someone, split into the three states that matter. */
async function taskLoad(userId: string) {
  const open = await TaskModel.find({
    assignedToUserId: userId,
    archivedAt: null,
  })
    .select("title code status dueAt priority parentTaskId")
    .sort({ dueAt: 1 })
    .limit(200)
    .lean();

  const live = open.filter((task) => !isClosedStatus(normalizeTaskStatus(task.status as string)));
  const now = new Date();
  const todayEnd = endOfToday();

  return {
    open: live,
    overdue: live.filter((task) => task.dueAt && new Date(task.dueAt) < now),
    dueToday: live.filter(
      (task) => task.dueAt && new Date(task.dueAt) >= startOfToday() && new Date(task.dueAt) <= todayEnd,
    ),
  };
}

function taskItems(
  tasks: Array<{ _id: unknown; title: string; code?: string | null; dueAt?: Date | null; parentTaskId?: unknown }>,
  tone: RoleListItem["tone"] = "default",
): RoleListItem[] {
  return tasks.slice(0, 5).map((task) => ({
    id: String(task._id),
    title: task.title,
    detail: task.code ?? "",
    meta: task.dueAt ? new Date(task.dueAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "",
    // A subtask has no page of its own; its parent is where it is worked on.
    href: `/tasks/${String(task.parentTaskId ?? task._id)}`,
    tone,
  }));
}

async function myAttendanceThisMonth(userId: string) {
  const monthKey = getAttendanceMonthKey();
  const rows = await AttendanceModel.find({
    userId,
    dateKey: { $regex: `^${monthKey}` },
  })
    .select("dayStatus workedMinutes")
    .lean();

  return {
    present: rows.filter((row) => row.dayStatus !== "absent").length,
    lateComing: rows.filter((row) => row.dayStatus === "late_coming").length,
    workedMinutes: rows.reduce((total, row) => total + (row.workedMinutes ?? 0), 0),
  };
}

async function myUpcomingMeetings(userId: string) {
  // A meeting is booked against a contact and picked up by a staff member later,
  // so "mine" means assigned to me - there is no attendee list on the model.
  const meetings = await MeetingModel.find({
    status: "confirmed",
    startAt: { $gte: new Date() },
    assignedToUserId: userId,
  })
    .select("contactName startAt type location")
    .sort({ startAt: 1 })
    .limit(5)
    .lean();

  return meetings.map((meeting) => ({
    id: String(meeting._id),
    title: (meeting.contactName as string) ?? "Meeting",
    detail: meeting.type === "online" ? "Online" : ((meeting.location as string) ?? "In person"),
    meta: new Date(meeting.startAt as Date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    href: "/meetings",
  }));
}

/** A salesperson opens this to see their book, their number, and who to call. */
async function salesDashboard(userId: string): Promise<RoleDashboard> {
  const monthKey = getAttendanceMonthKey();
  const owner = new Types.ObjectId(userId);

  const [openLeads, wonThisMonth, followUps, targets, progress, meetings, tasks] = await Promise.all([
    LeadModel.countDocuments({
      ownerId: owner,
      status: { $nin: ["closed_won", "closed_lost", "invalid", "wrong_number"] },
    }),
    LeadModel.countDocuments({
      "closure.salespersonId": owner,
      status: "closed_won",
      "closure.closedAt": { $gte: new Date(`${monthKey}-01T00:00:00`) },
    }),
    LeadFollowUpModel.find({ assignedToUserId: owner, status: "scheduled", dueAt: { $lte: endOfToday() } })
      .select("leadId nextAction dueAt")
      .sort({ dueAt: 1 })
      .limit(5)
      .lean(),
    SalesTargetModel.find({ assignedUserId: owner, period: "monthly", periodKey: monthKey })
      .select("metric target")
      .lean(),
    closedDealProgress([userId]),
    myUpcomingMeetings(userId),
    taskLoad(userId),
  ]);

  const achieved = progress.get(`${userId}:${monthKey}`) ?? { revenue: 0, deals: 0 };
  const followUpLeads = await LeadModel.find({ _id: { $in: followUps.map((item) => item.leadId) } })
    .select("title")
    .lean();
  const leadTitles = new Map(followUpLeads.map((lead) => [String(lead._id), lead.title as string]));

  return {
    headline: "Your pipeline today",
    metrics: [
      { key: "open", label: "Open leads", value: String(openLeads), tone: "blue" },
      { key: "won", label: "Closed this month", value: String(wonThisMonth), tone: "green" },
      {
        key: "revenue",
        label: "Revenue this month",
        value: `₹${INR.format(achieved.revenue)}`,
        tone: "violet",
      },
      {
        key: "followups",
        label: "Follow-ups due",
        value: String(followUps.length),
        hint: followUps.length > 0 ? "Includes anything overdue" : undefined,
        tone: followUps.length > 0 ? "amber" : "cyan",
      },
    ],
    progress: targets.map((target) => {
      const isRevenue = target.metric === "revenue";
      const value = isRevenue ? achieved.revenue : achieved.deals;
      return {
        label: isRevenue ? "Monthly revenue target" : "Monthly deals target",
        achieved: value,
        target: target.target as number,
        display: isRevenue
          ? `₹${INR.format(value)} of ₹${INR.format(target.target as number)}`
          : `${value} of ${target.target} deals`,
      };
    }),
    lists: [
      {
        title: "Follow-ups due",
        emptyText: "Nothing to chase right now.",
        href: "/follow-ups",
        items: followUps.map((item) => ({
          id: String(item._id),
          title: leadTitles.get(String(item.leadId)) ?? "Lead",
          detail: item.nextAction as string,
          meta: item.dueAt ? new Date(item.dueAt as Date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "",
          href: `/leads/${item.leadId}`,
          tone: "warning" as const,
        })),
      },
      { title: "Upcoming meetings", emptyText: "No meetings scheduled.", href: "/meetings", items: meetings },
      {
        title: "Your tasks",
        emptyText: "Nothing assigned to you.",
        href: "/tasks",
        items: taskItems(tasks.dueToday.length > 0 ? tasks.dueToday : tasks.open),
      },
    ],
  };
}

/** A developer opens this to see what is on them today, and their own attendance. */
async function developerDashboard(userId: string): Promise<RoleDashboard> {
  const [tasks, attendance] = await Promise.all([taskLoad(userId), myAttendanceThisMonth(userId)]);

  return {
    headline: "Your work today",
    metrics: [
      { key: "open", label: "Open tasks", value: String(tasks.open.length), tone: "blue" },
      { key: "today", label: "Due today", value: String(tasks.dueToday.length), tone: "amber" },
      {
        key: "overdue",
        label: "Overdue",
        value: String(tasks.overdue.length),
        tone: tasks.overdue.length > 0 ? "red" : "green",
      },
      {
        key: "worked",
        label: "Worked this month",
        value: hoursAndMinutes(attendance.workedMinutes),
        hint: `${attendance.present} days present`,
        tone: "violet",
      },
    ],
    progress: [],
    lists: [
      {
        title: "Overdue",
        emptyText: "Nothing overdue.",
        href: "/tasks",
        items: taskItems(tasks.overdue, "danger"),
      },
      { title: "Due today", emptyText: "Nothing due today.", href: "/tasks", items: taskItems(tasks.dueToday) },
      { title: "Everything assigned", emptyText: "Nothing assigned to you.", href: "/tasks", items: taskItems(tasks.open) },
    ],
  };
}

/** A project manager watches delivery across the team, not just their own queue. */
async function projectManagerDashboard(userId: string): Promise<RoleDashboard> {
  const now = new Date();
  const [allOpen, overdue, unassigned, meetings, mine] = await Promise.all([
    TaskModel.countDocuments({ archivedAt: null, status: { $nin: ["COMPLETED", "CANCELLED"] } }),
    TaskModel.find({ archivedAt: null, status: { $nin: ["COMPLETED", "CANCELLED"] }, dueAt: { $lt: now } })
      .select("title code dueAt parentTaskId")
      .sort({ dueAt: 1 })
      .limit(5)
      .lean(),
    TaskModel.countDocuments({ archivedAt: null, assignedToUserId: null, status: { $nin: ["COMPLETED", "CANCELLED"] } }),
    myUpcomingMeetings(userId),
    taskLoad(userId),
  ]);

  const overdueCount = await TaskModel.countDocuments({
    archivedAt: null,
    status: { $nin: ["COMPLETED", "CANCELLED"] },
    dueAt: { $lt: now },
  });

  return {
    headline: "Delivery at a glance",
    metrics: [
      { key: "open", label: "Open tasks", value: String(allOpen), tone: "blue" },
      { key: "overdue", label: "Overdue", value: String(overdueCount), tone: overdueCount > 0 ? "red" : "green" },
      { key: "unassigned", label: "Unassigned", value: String(unassigned), tone: unassigned > 0 ? "amber" : "cyan" },
      { key: "mine", label: "Assigned to you", value: String(mine.open.length), tone: "violet" },
    ],
    progress: [],
    lists: [
      { title: "Overdue across the team", emptyText: "Nothing overdue.", href: "/tasks", items: taskItems(overdue, "danger") },
      { title: "Upcoming meetings", emptyText: "No meetings scheduled.", href: "/meetings", items: meetings },
      { title: "Your tasks", emptyText: "Nothing assigned to you.", href: "/tasks", items: taskItems(mine.open) },
    ],
  };
}

/** Marketing cares where leads come from and how many are arriving. */
async function marketingDashboard(userId: string): Promise<RoleDashboard> {
  const monthKey = getAttendanceMonthKey();
  const monthStart = new Date(`${monthKey}-01T00:00:00`);

  const [thisMonth, untouched, sources, tasks] = await Promise.all([
    LeadModel.countDocuments({ createdAt: { $gte: monthStart } }),
    // Not "unassigned": the Lead pre-save hook round-robins an owner onto every
    // new lead, so that count is always zero and tells nobody anything. What
    // marketing can actually act on is inbound that nobody has spoken to yet.
    LeadModel.countDocuments({ status: "new" }),
    LeadModel.aggregate<{ _id: string | null; count: number }>([
      { $match: { createdAt: { $gte: monthStart } } },
      { $group: { _id: "$source", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    taskLoad(userId),
  ]);

  const topSource = sources[0];

  return {
    headline: "Lead flow this month",
    metrics: [
      { key: "new", label: "New leads", value: String(thisMonth), tone: "blue" },
      {
        key: "top",
        label: "Top source",
        value: topSource?._id ? String(topSource._id).replaceAll("_", " ") : "--",
        hint: topSource ? `${topSource.count} leads` : undefined,
        tone: "violet",
      },
      {
        key: "untouched",
        label: "Awaiting first contact",
        value: String(untouched),
        tone: untouched > 0 ? "amber" : "green",
      },
      { key: "tasks", label: "Your open tasks", value: String(tasks.open.length), tone: "cyan" },
    ],
    progress: sources.map((source) => ({
      label: source._id ? String(source._id).replaceAll("_", " ") : "unknown",
      achieved: source.count,
      target: thisMonth || 1,
      display: `${source.count} of ${thisMonth}`,
    })),
    lists: [
      { title: "Your tasks", emptyText: "Nothing assigned to you.", href: "/tasks", items: taskItems(tasks.open) },
    ],
  };
}

/**
 * Which dashboard a role gets. Admin and partner keep the full business
 * overview, which is a different page entirely; everyone else gets figures
 * scoped to what they do.
 */
export function usesBusinessOverview(role: UserRole) {
  return role === "admin" || role === "partner";
}

export async function getRoleDashboard(role: UserRole, userId: string): Promise<RoleDashboard> {
  await connectToDatabase();

  if (role === "sales") return salesDashboard(userId);
  if (role === "project_manager") return projectManagerDashboard(userId);
  if (role === "digital_marketing") return marketingDashboard(userId);
  return developerDashboard(userId);
}

export type SparkPoint = { label: string; value: number };

export type DeveloperDashboard = {
  headline: string;
  greetingName: string;
  quote: { text: string; footer: string };
  metrics: Array<
    RoleMetric & {
      /** Seven days of real history, oldest first. */
      series: number[];
      delta: number;
      shape: "line" | "bars";
    }
  >;
  lists: Array<{ title: string; emptyText: string; emptySubtext?: string; href: string; icon: "overdue" | "today" | "all"; items: RoleListItem[] }>;
  schedule: Array<{ id: string; time: string; title: string; detail: string }>;
  productivity: {
    perDay: SparkPoint[];
    completed: number;
    workedMinutes: number;
    ratePercent: number | null;
    deltaPercent: number | null;
  };
};

const QUOTES = [
  { text: "Small steps every day make big progress.", footer: "Keep going" },
  { text: "Consistency is the key to progress.", footer: "Keep building" },
  { text: "Finish one thing before starting the next.", footer: "Stay with it" },
  { text: "Done is better than perfect, then make it better.", footer: "Ship it" },
];

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** The last seven days, oldest first, as midnight boundaries. */
function lastSevenDays() {
  const days: Date[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = startOfDay(new Date());
    day.setDate(day.getDate() - offset);
    days.push(day);
  }
  return days;
}

type HistoryTask = {
  createdAt?: Date | null;
  dueAt?: Date | null;
  completedAt?: Date | null;
  status?: string | null;
};

/**
 * Rebuild what these counts were on each of the last seven days.
 *
 * Nothing records a daily snapshot, but createdAt, dueAt and completedAt between
 * them say what was true at any past moment - a task was open on day D if it
 * existed by then and had not been completed yet. That is a real series rather
 * than a decorative squiggle, which matters because the number beside it is read
 * as a trend.
 */
function taskHistory(tasks: HistoryTask[]) {
  const days = lastSevenDays();

  const openSeries: number[] = [];
  const overdueSeries: number[] = [];
  const dueSeries: number[] = [];

  for (const day of days) {
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    let open = 0;
    let overdue = 0;
    let due = 0;

    for (const task of tasks) {
      const created = task.createdAt ? new Date(task.createdAt) : null;
      const completed = task.completedAt ? new Date(task.completedAt) : null;
      const dueAt = task.dueAt ? new Date(task.dueAt) : null;
      const closedNow = isClosedStatus(normalizeTaskStatus(task.status ?? undefined));

      // A task can be closed without a completedAt - the field is only stamped by
      // the update route, so anything closed another way, or before that existed,
      // has none. Counting it as open would put the series out of step with the
      // figure printed beside it, which is read as the same number.
      if (closedNow && !completed) continue;

      const existedByThen = created ? created <= dayEnd : true;
      const stillOpenThen = !completed || completed > dayEnd;

      if (existedByThen && stillOpenThen) {
        open += 1;
        if (dueAt && dueAt < day) overdue += 1;
      }
      if (dueAt && dueAt >= day && dueAt <= dayEnd) due += 1;
    }

    openSeries.push(open);
    overdueSeries.push(overdue);
    dueSeries.push(due);
  }

  return { openSeries, overdueSeries, dueSeries };
}

function delta(series: number[]) {
  if (series.length < 2) return 0;
  return series[series.length - 1] - series[series.length - 2];
}

/** Meetings assigned to this person that start today. */
async function todaysSchedule(userId: string) {
  const dayStart = startOfToday();
  const dayEnd = endOfToday();

  const meetings = await MeetingModel.find({
    status: "confirmed",
    assignedToUserId: userId,
    startAt: { $gte: dayStart, $lte: dayEnd },
  })
    .select("contactName startAt type location notes durationMinutes")
    .sort({ startAt: 1 })
    .lean();

  return meetings.map((meeting) => ({
    id: String(meeting._id),
    time: new Date(meeting.startAt as Date).toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    }),
    title: (meeting.contactName as string) ?? "Meeting",
    detail:
      (meeting.notes as string) ||
      (meeting.type === "online" ? "Online" : ((meeting.location as string) ?? "In person")),
  }));
}

/**
 * This week's output.
 *
 * "Rate" is the share of tasks that were due this week and actually got
 * completed - a definition that can be checked, rather than a number with no
 * stated meaning. Null when nothing was due, because 0% would read as a failure
 * when in fact there was nothing to do.
 */
async function weeklyProductivity(userId: string) {
  const weekStart = startOfDay(new Date());
  weekStart.setDate(weekStart.getDate() - 6);
  const previousStart = new Date(weekStart);
  previousStart.setDate(previousStart.getDate() - 7);

  const [completedThisWeek, completedLastWeek, dueThisWeek, attendance] = await Promise.all([
    TaskModel.find({ assignedToUserId: userId, completedAt: { $gte: weekStart } })
      .select("completedAt")
      .lean(),
    TaskModel.countDocuments({
      assignedToUserId: userId,
      completedAt: { $gte: previousStart, $lt: weekStart },
    }),
    TaskModel.countDocuments({ assignedToUserId: userId, dueAt: { $gte: weekStart, $lte: endOfToday() } }),
    AttendanceModel.find({ userId, dateKey: { $gte: toDateKey(weekStart) } })
      .select("workedMinutes")
      .lean(),
  ]);

  const perDay = lastSevenDays().map((day) => {
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    return {
      label: day.toLocaleDateString("en-IN", { weekday: "short" }),
      value: completedThisWeek.filter((task) => {
        const at = new Date(task.completedAt as Date);
        return at >= day && at <= dayEnd;
      }).length,
    };
  });

  const completed = completedThisWeek.length;
  const workedMinutes = attendance.reduce((total, row) => total + (row.workedMinutes ?? 0), 0);

  return {
    perDay,
    completed,
    workedMinutes,
    ratePercent: dueThisWeek > 0 ? Math.round((completed / dueThisWeek) * 100) : null,
    deltaPercent:
      completedLastWeek > 0
        ? Math.round(((completed - completedLastWeek) / completedLastWeek) * 100)
        : null,
  };
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function getDeveloperDashboard(
  userId: string,
  greetingName: string,
): Promise<DeveloperDashboard> {
  await connectToDatabase();

  const [tasks, attendance, schedule, productivity, history] = await Promise.all([
    taskLoad(userId),
    myAttendanceThisMonth(userId),
    todaysSchedule(userId),
    weeklyProductivity(userId),
    TaskModel.find({ assignedToUserId: userId, archivedAt: null })
      .select("createdAt dueAt completedAt status")
      .limit(500)
      .lean()
      .then((rows) => taskHistory(rows as HistoryTask[])),
  ]);

  // A different line each day, so it changes without needing anywhere to store it.
  const quote = QUOTES[new Date().getDate() % QUOTES.length];

  return {
    headline: "Your work today",
    greetingName,
    quote,
    metrics: [
      {
        key: "open",
        label: "Open tasks",
        value: String(tasks.open.length),
        tone: "blue",
        series: history.openSeries,
        delta: delta(history.openSeries),
        shape: "line",
      },
      {
        key: "today",
        label: "Due today",
        value: String(tasks.dueToday.length),
        tone: "green",
        series: history.dueSeries,
        delta: delta(history.dueSeries),
        shape: "line",
      },
      {
        key: "overdue",
        label: "Overdue",
        value: String(tasks.overdue.length),
        tone: tasks.overdue.length > 0 ? "red" : "green",
        series: history.overdueSeries,
        delta: delta(history.overdueSeries),
        shape: "line",
      },
      {
        key: "worked",
        label: "Worked this month",
        value: hoursAndMinutes(attendance.workedMinutes),
        hint: `${attendance.present} day${attendance.present === 1 ? "" : "s"} present`,
        tone: "violet",
        series: productivity.perDay.map((point) => point.value),
        delta: 0,
        shape: "bars",
      },
    ],
    lists: [
      {
        title: "Overdue tasks",
        emptyText: "Nothing overdue.",
        emptySubtext: "You are on top of it.",
        href: "/tasks",
        icon: "overdue",
        items: taskItems(tasks.overdue, "danger"),
      },
      {
        title: "Due today",
        emptyText: "Nothing due today.",
        emptySubtext: "You're all caught up!",
        href: "/tasks",
        icon: "today",
        items: taskItems(tasks.dueToday),
      },
      {
        title: "Everything assigned",
        emptyText: "Nothing assigned to you.",
        href: "/tasks",
        icon: "all",
        items: taskItems(tasks.open),
      },
    ],
    schedule,
    productivity,
  };
}
