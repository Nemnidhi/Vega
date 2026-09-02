type AiMode =
  | "generate_subtasks"
  | "break_down_subtask"
  | "suggest_dependencies"
  | "generate_workflow"
  | "detect_problems";

type SubtaskForAi = {
  _id: unknown;
  code?: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assignedToUserId?: unknown;
  startAt?: Date | string | null;
  dueAt?: Date | string | null;
  estimatedEffortHours?: number | null;
  progressPercent?: number | null;
  stage?: string;
  workflowNodeType?: string;
};

type DependencyForAi = {
  _id: unknown;
  predecessorSubtaskId: unknown;
  successorSubtaskId: unknown;
  dependencyType?: string;
};

type AiContext = {
  task: { _id: unknown; title: string; description?: string; dueAt?: Date | string | null };
  subtasks: SubtaskForAi[];
  dependencies: DependencyForAi[];
  prompt?: string;
  subtaskId?: string;
};

type WorkflowProblem = {
  severity: "warning" | "danger";
  title: string;
  detail: string;
  subtaskIds?: string[];
};

const SYSTEM_PROMPT = [
  "You are an assistant for a production task workflow system.",
  "Never say changes have been applied. Return proposals only.",
  "Use concise business-task language.",
  "Return valid JSON only with keys: summary, subtasks, checklistItems, dependencies, problems.",
  "Subtask statuses must be NOT_STARTED, READY, IN_PROGRESS, WAITING, BLOCKED, REVIEW, COMPLETED, or CANCELLED.",
  "Priorities must be LOW, MEDIUM, HIGH, or URGENT.",
  "Dependency type must be FINISH_TO_START, START_TO_START, or FINISH_TO_FINISH.",
].join("\n");

function id(value: unknown) {
  return String((value as { _id?: unknown })?._id ?? value ?? "");
}

function daysBetween(start?: Date | string | null, due?: Date | string | null) {
  if (!start || !due) return null;
  const startTime = new Date(start).setHours(0, 0, 0, 0);
  const dueTime = new Date(due).setHours(0, 0, 0, 0);
  return Math.round((dueTime - startTime) / 86_400_000) + 1;
}

function lowerTitle(subtask: SubtaskForAi) {
  return `${subtask.title} ${subtask.description ?? ""}`.toLowerCase();
}

function longestPath(subtaskIds: string[], dependencies: DependencyForAi[]) {
  const successors = new Map<string, string[]>();
  dependencies.forEach((dependency) => {
    const predecessor = id(dependency.predecessorSubtaskId);
    const successor = id(dependency.successorSubtaskId);
    successors.set(predecessor, [...(successors.get(predecessor) ?? []), successor]);
  });

  const visit = (nodeId: string, seen = new Set<string>()): number => {
    if (seen.has(nodeId)) return 999;
    const nextSeen = new Set(seen);
    nextSeen.add(nodeId);
    const next = successors.get(nodeId) ?? [];
    if (next.length === 0) return 1;
    return 1 + Math.max(...next.map((successor) => visit(successor, nextSeen)));
  };

  return Math.max(0, ...subtaskIds.map((subtaskId) => visit(subtaskId)));
}

function detectCycle(subtaskIds: string[], dependencies: DependencyForAi[]) {
  const successors = new Map<string, string[]>();
  dependencies.forEach((dependency) => {
    const predecessor = id(dependency.predecessorSubtaskId);
    const successor = id(dependency.successorSubtaskId);
    successors.set(predecessor, [...(successors.get(predecessor) ?? []), successor]);
  });

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    const hasCycle = (successors.get(nodeId) ?? []).some(visit);
    visiting.delete(nodeId);
    visited.add(nodeId);
    return hasCycle;
  };

  return subtaskIds.some(visit);
}

export function detectWorkflowProblems(context: AiContext) {
  const problems: WorkflowProblem[] = [];
  const subtaskIds = context.subtasks.map((subtask) => id(subtask._id));
  const predecessorIds = new Set(context.dependencies.map((dependency) => id(dependency.predecessorSubtaskId)));
  const successorIds = new Set(context.dependencies.map((dependency) => id(dependency.successorSubtaskId)));

  if (detectCycle(subtaskIds, context.dependencies)) {
    problems.push({
      severity: "danger",
      title: "Circular dependency",
      detail: "The workflow contains a dependency loop and cannot calculate execution order reliably.",
    });
  }

  if (context.subtasks.length > 2 && context.dependencies.length === 0) {
    problems.push({
      severity: "warning",
      title: "Missing dependencies",
      detail: "This task has multiple subtasks but no dependency structure.",
    });
  }

  const isolated = context.subtasks.filter((subtask) => !predecessorIds.has(id(subtask._id)) && !successorIds.has(id(subtask._id)));
  if (context.dependencies.length > 0 && isolated.length > 0) {
    problems.push({
      severity: "warning",
      title: "Disconnected subtasks",
      detail: `${isolated.length} subtask(s) are not connected to the workflow.`,
      subtaskIds: isolated.map((subtask) => id(subtask._id)),
    });
  }

  const unassigned = context.subtasks.filter((subtask) => !id(subtask.assignedToUserId));
  if (unassigned.length > 0) {
    problems.push({
      severity: "warning",
      title: "Unassigned work",
      detail: `${unassigned.length} subtask(s) do not have an assignee.`,
      subtaskIds: unassigned.map((subtask) => id(subtask._id)),
    });
  }

  const impossible = context.subtasks.filter((subtask) => {
    const duration = daysBetween(subtask.startAt, subtask.dueAt);
    if (duration !== null && duration <= 0) return true;
    return duration !== null && subtask.estimatedEffortHours !== null && subtask.estimatedEffortHours !== undefined && subtask.estimatedEffortHours > duration * 10;
  });
  if (impossible.length > 0) {
    problems.push({
      severity: "danger",
      title: "Impossible deadlines",
      detail: `${impossible.length} subtask(s) have dates or effort that look unrealistic.`,
      subtaskIds: impossible.map((subtask) => id(subtask._id)),
    });
  }

  const effortByAssigneeDay = new Map<string, number>();
  context.subtasks.forEach((subtask) => {
    if (!subtask.dueAt || !subtask.assignedToUserId || !subtask.estimatedEffortHours) return;
    const key = `${id(subtask.assignedToUserId)}:${new Date(subtask.dueAt).toISOString().slice(0, 10)}`;
    effortByAssigneeDay.set(key, (effortByAssigneeDay.get(key) ?? 0) + subtask.estimatedEffortHours);
  });
  if ([...effortByAssigneeDay.values()].some((hours) => hours > 10)) {
    problems.push({
      severity: "warning",
      title: "Overloaded user",
      detail: "At least one assignee has more than 10 estimated hours due on the same day.",
    });
  }

  const hasDevelopment = context.subtasks.some((subtask) => /develop|frontend|backend|integration|build|implement/.test(lowerTitle(subtask)));
  const hasQa = context.subtasks.some((subtask) => /qa|test|testing|quality|review/.test(lowerTitle(subtask)));
  if (hasDevelopment && !hasQa) {
    problems.push({
      severity: "warning",
      title: "Missing QA",
      detail: "Development work is present, but no QA/testing subtask was found.",
    });
  }

  const criticalPathLength = longestPath(subtaskIds, context.dependencies);
  if (criticalPathLength >= 8) {
    problems.push({
      severity: "warning",
      title: "Large critical path",
      detail: `The longest dependency chain contains ${criticalPathLength} subtasks.`,
    });
  }

  const blocked = context.subtasks.filter((subtask) => subtask.status === "BLOCKED");
  if (blocked.length >= 3 || criticalPathLength >= 6) {
    problems.push({
      severity: "warning",
      title: "Long blocked chain",
      detail: "The workflow may have a long chain where one delayed item can hold up several successors.",
      subtaskIds: blocked.map((subtask) => id(subtask._id)),
    });
  }

  return problems;
}

function extractOutputText(response: unknown) {
  const direct = (response as { output_text?: string }).output_text;
  if (direct) return direct;
  const output = (response as { output?: Array<{ content?: Array<{ text?: string }> }> }).output ?? [];
  return output.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("\n");
}

function proposalSchemaHint(mode: AiMode) {
  if (mode === "break_down_subtask") {
    return "For break_down_subtask, prefer checklistItems with title and order. Include subtasks only if useful as peer subtasks under the same parent task.";
  }
  if (mode === "suggest_dependencies") {
    return "For suggest_dependencies, use existing subtask IDs in predecessorSubtaskId and successorSubtaskId. Do not invent new subtasks.";
  }
  if (mode === "generate_workflow") {
    return "For generate_workflow, include proposed subtasks with tempId values like AI-001 and dependencies that reference those tempIds.";
  }
  return "For generate_subtasks, include proposed subtasks with tempId values like AI-001. Dependencies are optional.";
}

export async function generateAiTaskProposal(mode: AiMode, context: AiContext) {
  if (mode === "detect_problems") {
    return { summary: "Workflow problem scan completed.", subtasks: [], checklistItems: [], dependencies: [], problems: detectWorkflowProblems(context), source: "rules" };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("AI assistant is not configured. Set OPENAI_API_KEY to enable proposals.");
  }

  const model = process.env.OPENAI_TASK_MODEL ?? "gpt-5-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            mode,
            instruction: proposalSchemaHint(mode),
            task: context.task,
            subtasks: context.subtasks,
            dependencies: context.dependencies,
            selectedSubtaskId: context.subtaskId,
            userPrompt: context.prompt,
          }),
        },
      ],
      text: { format: { type: "json_object" } },
      max_output_tokens: 2500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI proposal failed: ${errorText.slice(0, 300)}`);
  }

  const payload = await response.json();
  const text = extractOutputText(payload);
  const parsed = JSON.parse(text);
  return {
    summary: String(parsed.summary ?? "AI proposal generated."),
    subtasks: Array.isArray(parsed.subtasks) ? parsed.subtasks : [],
    checklistItems: Array.isArray(parsed.checklistItems) ? parsed.checklistItems : [],
    dependencies: Array.isArray(parsed.dependencies) ? parsed.dependencies : [],
    problems: Array.isArray(parsed.problems) ? parsed.problems : [],
    source: "ai",
  };
}
