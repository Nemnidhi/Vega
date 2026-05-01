import { z } from "zod";

export const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");

export const positiveNumberSchema = z.number().finite().min(0);

export const nonEmptyStringSchema = z.string().trim().min(1);

export const csvListToArray = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
