import type { DatabaseRecord, FinalDecision, ReviewChoice } from "@az-refresh/shared";

export type AdminAggregate = {
  record: DatabaseRecord;
  votes: Record<ReviewChoice, number>;
  reviews: ReviewSummary[];
  finalDecision: FinalDecisionSummary | null;
  completionStatus: string;
};

export type ReviewSummary = {
  id: string;
  reviewerId: string;
  sessionId: string;
  databaseId: string;
  selectedSubjects: string[];
  choice: ReviewChoice;
  revisedDescriptionHtml: string;
  comments: string;
  updatedAt: string;
  createdAt: string;
};

export type FinalDecisionSummary = {
  databaseId: string;
  decision: FinalDecision;
  selectedReviewId: string | null;
  finalDescriptionHtml: string;
  finalized: boolean;
  finalizedAt: string | null;
  updatedAt: string;
};

export type Reviewer = {
  id: string;
  name: string;
  email: string;
};
