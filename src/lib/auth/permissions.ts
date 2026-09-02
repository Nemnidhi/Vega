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

/**
 * The acting user for this request, from the session cookie.
 *
 * This used to accept an `allowHeaderFallback` option that read identity and role straight
 * out of the `x-user-id` / `x-user-role` request headers when no cookie was present -
 * client-controlled values, unsigned and never checked against the database. Nothing passed
 * the option, but any route that started to would have become a complete authentication
 * bypass: send `x-user-role: admin` and you were an admin. It is removed rather than left
 * switched off, and src/proxy.ts strips both headers at the edge of the API.
 *
 * A server-to-server caller that genuinely needs to act for a user does what the client
 * portal integration already does: proves itself with a shared secret, then re-derives a real
 * session from the database (see resolveClientPortalActor).
 */
export async function getActorContext(): Promise<ActorContext> {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  return { userId: session.userId, role: session.role };
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
