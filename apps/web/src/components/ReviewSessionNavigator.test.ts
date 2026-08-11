import type { DatabaseRecord } from "@az-refresh/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ReviewSummary } from "../types";
import { ReviewSessionNavigator } from "./ReviewSessionNavigator";

describe("ReviewSessionNavigator", () => {
  it("renders session tallies and accessible saved statuses", () => {
    const records = [record("one", "Database One"), record("two", "Database Two")];
    const savedReviews = { one: review("one") };
    const markup = renderToStaticMarkup(
      createElement(ReviewSessionNavigator, { records, currentIndex: 1, savedReviews, onNavigate: () => undefined })
    );

    expect(markup).toContain("1 saved");
    expect(markup).toContain("1 no input");
    expect(markup).toContain("Database 1, Database One: saved");
    expect(markup).toContain("Database 2, Database Two: no input");
    expect(markup).toContain('aria-current="step"');
  });
});

function record(databaseId: string, databaseName: string): DatabaseRecord {
  return {
    databaseId,
    databaseName,
    databaseUrl: "",
    originalDescriptionHtml: "",
    rewrittenDescriptionAHtml: "",
    rewrittenDescriptionBHtml: "",
    associatedSubjects: [],
    springshareMetadata: {}
  };
}

function review(databaseId: string): ReviewSummary {
  return {
    id: `review-${databaseId}`,
    reviewerId: "reviewer",
    reviewerName: "Reviewer",
    reviewerEmail: "reviewer@example.com",
    sessionId: "session",
    databaseId,
    selectedSubjects: [],
    choice: "original",
    revisedDescriptionHtml: "",
    comments: "",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z"
  };
}
