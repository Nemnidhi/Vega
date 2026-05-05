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
    ["admin", "partner", "sales", "project_manager", "developer", "client"].includes(roleHeader)
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
  manageLeads: ["admin", "partner", "sales"] as UserRole[],
  manageProposals: ["admin", "partner", "sales"] as UserRole[],
  approveHighTicket: ["admin", "partner"] as UserRole[],
  manageScope: ["admin", "partner", "project_manager"] as UserRole[],
  managePricing: ["admin", "partner"] as UserRole[],
  manageUsers: ["admin"] as UserRole[],
  manageProjectAssignments: ["admin"] as UserRole[],
  accessProjectAssignments: ["admin", "developer"] as UserRole[],
  createChangeOrders: ["admin", "partner", "project_manager", "sales"] as UserRole[],
  accessClientVault: ["admin", "partner", "project_manager", "client"] as UserRole[],
};
