import { z } from "zod";

import { PLAN_STEP_TYPES } from "../../../domain/Plan";
const planStepTypeSchema = z.enum(PLAN_STEP_TYPES);

const planStepSchema = z.object({
  id: z.string().min(1),
  type: planStepTypeSchema,
  description: z.string().min(1),
  dependsOn: z.array(z.string()).default([]),
  args: z.record(z.string(), z.unknown()).default({}),
  approvalRequired: z.boolean().default(false),
});

const slotRoleSchema = z.enum([
  "outbound_date",
  "return_date",
  "destination",
]);

const needInputSchema = z.object({
  kind: z.literal("need_input"),
  assistantMessage: z.string().min(1),
  missingSlots: z
    .array(
      z.object({
        id: z.string().min(1),
        role: slotRoleSchema,
        label: z.string().min(1),
      }),
    )
    .min(1)
    .max(5),
});

const planKindSchema = z.object({
  kind: z.literal("plan"),
  goal: z.string().min(1),
  steps: z.array(planStepSchema).min(1).max(8),
});

export const plannerUnionSchema = z.discriminatedUnion("kind", [
  needInputSchema,
  planKindSchema,
]);
