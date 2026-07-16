import type { ReviewChoice } from "@az-refresh/shared";

export type ReviewFormValues = {
  choice: ReviewChoice | null;
  revision: string;
  comments: string;
};

type SavedReviewValues = {
  choice: ReviewChoice;
  revisedDescriptionHtml: string;
  comments: string;
};

export function isReviewFormDirty(form: ReviewFormValues, saved?: SavedReviewValues): boolean {
  return (
    form.choice !== (saved?.choice ?? null) ||
    form.revision !== (saved?.revisedDescriptionHtml ?? "") ||
    form.comments !== (saved?.comments ?? "")
  );
}

export function getReviewSessionCounts(databaseIds: string[], savedDatabaseIds: ReadonlySet<string>) {
  const saved = databaseIds.reduce((count, databaseId) => count + Number(savedDatabaseIds.has(databaseId)), 0);
  return { saved, noInput: databaseIds.length - saved };
}
