import { z } from "zod";

export const ReviewChoiceSchema = z.enum([
  "original",
  "rewritten_a",
  "rewritten_b",
  "edited",
  "needs_follow_up"
]);

export const FinalDecisionSchema = z.enum([
  "use_original",
  "use_rewritten_a",
  "use_rewritten_b",
  "use_faculty_revision",
  "custom_final",
  "hold"
]);

export const DatabaseRecordSchema = z.object({
  databaseId: z.string().min(1),
  databaseName: z.string().min(1),
  databaseUrl: z.string().optional().default(""),
  originalDescriptionHtml: z.string().optional().default(""),
  rewrittenDescriptionAHtml: z.string().optional().default(""),
  rewrittenDescriptionBHtml: z.string().optional().default(""),
  associatedSubjects: z.array(z.string().min(1)),
  springshareMetadata: z.record(z.string(), z.unknown()).default({})
});

export const ImportCommitSchema = z.object({
  filename: z.string().min(1),
  sourceWorkbookBase64: z.string().optional().default(""),
  records: z.array(DatabaseRecordSchema).min(1)
});

export const ReviewerCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email()
});

export const SessionStartSchema = z.object({
  selectedSubjects: z.array(z.string().min(1)).min(1)
});

export const ReviewUpsertSchema = z.object({
  sessionId: z.string().min(1),
  databaseId: z.string().min(1),
  selectedSubjects: z.array(z.string().min(1)),
  choice: ReviewChoiceSchema,
  revisedDescriptionHtml: z.string().optional().default(""),
  comments: z.string().optional().default("")
});

export const FinalDecisionUpsertSchema = z.object({
  databaseId: z.string().min(1),
  decision: FinalDecisionSchema,
  finalDescriptionHtml: z.string().optional().default(""),
  selectedReviewId: z.string().optional().nullable(),
  finalized: z.boolean().default(false)
});

export type ReviewChoice = z.infer<typeof ReviewChoiceSchema>;
export type FinalDecision = z.infer<typeof FinalDecisionSchema>;
export type DatabaseRecord = z.infer<typeof DatabaseRecordSchema>;
export type ImportCommit = z.infer<typeof ImportCommitSchema>;
export type ReviewerCreate = z.infer<typeof ReviewerCreateSchema>;
export type ReviewUpsert = z.infer<typeof ReviewUpsertSchema>;
export type FinalDecisionUpsert = z.infer<typeof FinalDecisionUpsertSchema>;

export type ImportValidationResult = {
  errors: string[];
  warnings: string[];
  records: DatabaseRecord[];
  subjects: string[];
};
