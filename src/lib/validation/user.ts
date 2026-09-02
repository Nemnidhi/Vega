import { z } from "zod";
import { LOGIN_ROLES } from "@/lib/auth/constants";

const createUserRoleSchema = z.enum(LOGIN_ROLES);

export const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().email(),
  role: createUserRoleSchema,
  password: z.string().min(8).max(72),
  status: z.enum(["active", "inactive", "invited"]).default("active"),
});

export const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    email: z.string().email().optional(),
    role: createUserRoleSchema.optional(),
    password: z.string().min(8).max(72).optional(),
    status: z.enum(["active", "inactive", "invited"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required to update user credentials.",
  });

export const passwordChangeRequestSchema = z
  .object({
    // Proves the requester is the account holder and not just someone holding the session -
    // a borrowed laptop or a stolen cookie. The admin approving the request has no other
    // signal that it came from the real user.
    currentPassword: z.string().min(1).max(72),
    newPassword: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "New password and confirm password do not match.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: "New password must be different from your current password.",
    path: ["newPassword"],
  });

export const reviewPasswordChangeRequestSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reviewNote: z.string().trim().max(500).optional(),
});
