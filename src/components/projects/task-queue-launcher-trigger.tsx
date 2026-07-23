"use client";

import { type ReactNode } from "react";

const taskAssignmentEventName = "project-task-assignment:open";

export function dispatchTaskAssignmentOpen(projectId: string) {
  window.dispatchEvent(
    new CustomEvent(taskAssignmentEventName, {
      detail: { projectId },
    }),
  );
}

export function listenForTaskAssignmentOpen(
  callback: (projectId: string) => void,
) {
  function onOpen(event: Event) {
    const detail = (event as CustomEvent<{ projectId?: string }>).detail;
    if (detail?.projectId) {
      callback(detail.projectId);
    }
  }

  window.addEventListener(taskAssignmentEventName, onOpen);
  return () => window.removeEventListener(taskAssignmentEventName, onOpen);
}

export function TaskQueueSvgTrigger({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label="Open task assignment modal"
      style={{ cursor: "pointer" }}
      onClick={() => dispatchTaskAssignmentOpen(projectId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          dispatchTaskAssignmentOpen(projectId);
        }
      }}
    >
      {children}
    </g>
  );
}

export function TaskQueueCardTrigger({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="block w-full text-left"
      onClick={() => dispatchTaskAssignmentOpen(projectId)}
    >
      {children}
    </button>
  );
}
