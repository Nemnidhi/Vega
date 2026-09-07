import { z } from "zod";
import {
  leadFollowUpChannelValues,
  leadFollowUpOutcomeValues,
  leadFollowUpPriorityValues,
  leadFollowUpStatusValues,
} from "@/models/LeadFollowUp";
import { objectIdSchema } from "@/lib/validation/common";

export const createLeadFollowUpSchema = z.object({
  channel: z.enum(leadFollowUpChannelValues).default("call"),
  priority: z.enum(leadFollowUpPriorityValues).default("medium"),
  dueAt: z.coerce.date(),
  nextAction: z.string().trim().min(2).max(200),
  notes: z.string().trim().max(2000).optional().default(""),
  assignedToUserId: objectIdSchema.nullable().optional(),
});

export const updateLeadFollowUpSchema = z.object({
  status: z.enum(leadFollowUpStatusValues).optional(),
  channel: z.enum(leadFollowUpChannelValues).optional(),
  priority: z.enum(leadFollowUpPriorityValues).optional(),
  dueAt: z.coerce.date().optional(),
  nextAction: z.string().trim().min(2).max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  outcome: z.enum(leadFollowUpOutcomeValues).nullable().optional(),
  outcomeNote: z.string().trim().max(2000).optional(),
  assignedToUserId: objectIdSchema.nullable().optional(),
});
