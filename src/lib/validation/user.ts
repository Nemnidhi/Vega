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
