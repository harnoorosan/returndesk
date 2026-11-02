import { z } from "zod";
import { REASONS, RESOLUTIONS, SORTS, STATUSES } from "@/domain/lifecycle";

const requiredText = (max: number) =>
  z
    .string({ error: "This field is required." })
    .trim()
    .min(1, "This field is required.")
    .max(max, `Use ${max} characters or fewer.`);

export const createRequestSchema = z.object({
  customerName: requiredText(120),
  contact: requiredText(160).refine((value) => value.length >= 3, {
    message: "Enter an email or phone number.",
  }),
  orderNumber: requiredText(40),
  itemName: requiredText(160),
  quantity: z
    .number({ error: "Quantity must be a whole number." })
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(999, "Quantity must be 999 or less."),
  reason: z.enum(REASONS, { error: "Choose a reason." }),
});

export const updateRequestSchema = createRequestSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one detail to update.",
  });

export const noteSchema = z.object({
  body: z
    .string({ error: "Write a note before saving." })
    .trim()
    .min(1, "Write a note before saving.")
    .max(2000, "Notes must be 2000 characters or fewer."),
  author: z
    .string()
    .trim()
    .min(1, "Enter a name for the note.")
    .max(80, "Name must be 80 characters or fewer.")
    .optional(),
});

export const transitionSchema = z.object({
  to: z.enum(STATUSES, { error: "Choose a status to move to." }),
  resolution: z.enum(RESOLUTIONS, { error: "Choose a resolution." }).optional(),
  refundAmount: z.union([z.string(), z.number(), z.null()]).optional(),
});

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

export const listQuerySchema = z.object({
  q: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(120, "Search must be 120 characters or fewer.").optional(),
  ),
  status: z.preprocess(
    emptyToUndefined,
    z.enum(STATUSES, { error: "That status filter is not valid." }).optional(),
  ),
  reason: z.preprocess(
    emptyToUndefined,
    z.enum(REASONS, { error: "That reason filter is not valid." }).optional(),
  ),
  sort: z.preprocess(
    emptyToUndefined,
    z.enum(SORTS, { error: "That sort is not valid." }).default("newest"),
  ),
  page: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: "Page must be a whole number." })
      .int("Page must be a whole number.")
      .min(1, "Page must be 1 or greater.")
      .default(1),
  ),
  pageSize: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: "Page size must be a whole number." })
      .int("Page size must be a whole number.")
      .min(1, "Page size must be at least 1.")
      .max(50, "Page size must be 50 or less.")
      .default(10),
  ),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;
export type NoteInput = z.infer<typeof noteSchema>;
export type TransitionInput = z.infer<typeof transitionSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
