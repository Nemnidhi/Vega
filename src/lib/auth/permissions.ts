import { headers } from "next/headers";
import { getCurrentSession } from "@/lib/auth/session";
import type { UserRole } from "@/types/user";

type ActorContext = {
  userId: string;
  role: UserRole;
};

const roleMatrix: Record<UserRole, number> = {
  client: 1,
  developer: 2,
  sales: 3,
  digital_marketing: 3,
  project_manager: 4,
  partner: 5,
  admin: 6,
};

export async function getActorContext(options?: {
  allowHeaderFallback?: boolean;
}): Promise<ActorContext> {
  const session = await getCurrentSession();
  if (session) {
    return { userId: session.userId, role: session.role };
  }

  if (!options?.allowHeaderFallback) {
    throw new Error("Unauthorized");
  }

  const requestHeaders = await headers();
  const userId = requestHeaders.get("x-user-id");
  const roleHeader = requestHeaders.get("x-user-role");

  if (!userId || !roleHeader) {
    throw new Error("Unauthorized");
  }

  const role =
    roleHeader &&
    [
      "admin",
      "partner",
      "sales",
      "digital_marketing",
      "project_manager",
      "developer",
      "client",
    ].includes(roleHeader)
      ? (roleHeader as UserRole)
      : null;

  if (!role) {
    throw new Error("Unauthorized");
  }

  return { userId, role };
}

export function canAccessAtLeast(actorRole: UserRole, minimumRole: UserRole) {
  return roleMatrix[actorRole] >= roleMatrix[minimumRole];
}

export function assertRoleAccess(
  actorRole: UserRole,
  options: { atLeast?: UserRole; oneOf?: UserRole[] },
) {
  if (options.atLeast && !canAccessAtLeast(actorRole, options.atLeast)) {
    throw new Error(`Forbidden for role ${actorRole}`);
  }

  if (options.oneOf && !options.oneOf.includes(actorRole)) {
    throw new Error(`Forbidden for role ${actorRole}`);
  }
}

export const permissionRules = {
  manageLeads: ["admin", "partner", "sales", "digital_marketing"] as UserRole[],
  manageProposals: ["admin", "partner", "sales", "digital_marketing"] as UserRole[],
  approveHighTicket: ["admin", "partner"] as UserRole[],
  manageScope: ["admin", "partner", "project_manager"] as UserRole[],
  // Marketing owns the pricing catalog/segments/tiers/packages day to day -
  // full write access, not just read, per the 2026-08-16 decision to move
  // pricing off a spreadsheet into an editable admin UI.
  managePricing: ["admin", "partner", "digital_marketing"] as UserRole[],
  manageUsers: ["admin"] as UserRole[],
  manageProjectAssignments: ["admin"] as UserRole[],
  accessProjectAssignments: ["admin", "developer"] as UserRole[],
  createChangeOrders: ["admin", "partner", "project_manager", "sales", "digital_marketing"] as UserRole[],
  accessClientVault: ["admin", "partner", "project_manager", "client"] as UserRole[],
  // Anyone non-client can create/complete their own tasks (enforced in the route handler, not
  // here); this rule gates the higher-privilege action of assigning a task to someone else.
  assignTasksToOthers: ["admin", "partner", "project_manager"] as UserRole[],
  manageKpis: ["admin", "partner", "project_manager"] as UserRole[],
  // Gates cancelling a meeting and editing the shared availability config - viewing the
  // upcoming list and self-assigning are open to any staff role, enforced in the route.
  manageMeetings: ["admin", "partner", "sales", "project_manager"] as UserRole[],
};
