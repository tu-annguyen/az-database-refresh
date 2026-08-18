import type { DatabaseRecord } from "@az-refresh/shared";
import { describe, expect, it } from "vitest";
import type { AdminAggregate } from "../types";
import { filterAndSortAggregates } from "./resultFilters";

describe("filterAndSortAggregates", () => {
  const items = [aggregate("b", "Beta", 2), aggregate("a", "Alpha", 0), aggregate("c", "Charlie", 1, true)];

  it("filters by text and vote status", () => {
    expect(filterAndSortAggregates(items, "be", "some", "all", "name").map(id)).toEqual(["b"]);
    expect(filterAndSortAggregates(items, "", "none", "all", "name").map(id)).toEqual(["a"]);
  });

  it("filters by open or finalized status", () => {
    expect(filterAndSortAggregates(items, "", "all", "open", "name").map(id)).toEqual(["a", "b"]);
    expect(filterAndSortAggregates(items, "", "all", "finalized", "name").map(id)).toEqual(["c"]);
  });

  it("sorts vote counts in either direction with stable name tie-breaking", () => {
    expect(filterAndSortAggregates(items, "", "all", "all", "votes_asc").map(id)).toEqual(["a", "c", "b"]);
    expect(filterAndSortAggregates(items, "", "all", "all", "votes_desc").map(id)).toEqual(["b", "c", "a"]);
  });
});

function id(item: AdminAggregate): string { return item.record.databaseId; }

function aggregate(databaseId: string, databaseName: string, votes: number, finalized = false): AdminAggregate {
  const record: DatabaseRecord = {
    databaseId, databaseName, databaseUrl: "", originalDescriptionHtml: "", rewrittenDescriptionAHtml: "",
    rewrittenDescriptionBHtml: "", associatedSubjects: [], springshareMetadata: {}
  };
  return {
    record,
    votes: { original: votes, rewritten_a: 0, rewritten_b: 0, edited: 0, needs_follow_up: 0 },
    reviews: Array.from({ length: votes }, (_, index) => ({
      id: String(index), reviewerId: "r", reviewerName: "R", reviewerEmail: "r@example.com", sessionId: "s",
      databaseId, selectedSubjects: [], choice: "original" as const, revisedDescriptionHtml: "", comments: "",
      updatedAt: "", createdAt: ""
    })),
    finalDecision: finalized ? {
      databaseId, decision: "original", selectedReviewId: null, finalDescriptionHtml: "",
      oneSearchIcon: false, artificialIntelligenceIcon: false, finalized: true,
      finalizedAt: "2026-07-27T00:00:00.000Z", updatedAt: "2026-07-27T00:00:00.000Z"
    } : null,
    completionStatus: votes ? "reviewed" : "unreviewed"
  };
}
