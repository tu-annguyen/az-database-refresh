import type { DatabaseRecord, FinalDecision, ReviewChoice } from "./schemas";

type ReviewCandidate = {
  id: string;
  choice: ReviewChoice;
  revisedDescriptionHtml?: string;
};

export function resolveFinalDescription(
  decision: FinalDecision,
  record: DatabaseRecord,
  customFinalDescriptionHtml: string,
  facultyRevision?: ReviewCandidate | null
): string {
  switch (decision) {
    case "use_original":
      return record.originalDescriptionHtml;
    case "use_rewritten_a":
      return record.rewrittenDescriptionAHtml;
    case "use_rewritten_b":
      return record.rewrittenDescriptionBHtml;
    case "use_faculty_revision":
      return facultyRevision?.revisedDescriptionHtml ?? "";
    case "custom_final":
      return customFinalDescriptionHtml;
    case "hold":
      return "";
  }
}
