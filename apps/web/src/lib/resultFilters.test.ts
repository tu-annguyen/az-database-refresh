import type { DatabaseRecord } from "@az-refresh/shared";
import { describe, expect, it } from "vitest";
import type { AdminAggregate } from "../types";
import { filterAndSortAggregates } from "./resultFilters";

describe("filterAndSortAggregates", () => {
  const items = [aggregate("b", "Beta", 2), aggregate("a", "Alpha", 0), aggregate("c", "Charlie", 1)];

  it("filters by text and vote status", () => {
    expect(filterAndSortAggregates(items, "be", "some", "name").map(id)).toEqual(["b"]);
    expect(filterAndSortAggregates(items, "", "none", "name").map(id)).toEqual(["a"]);
  });

  it("sorts vote counts in either direction with stable name tie-breaking", () => {
    expect(filterAndSortAggregates(items, "", "all", "votes_asc").map(id)).toEqual(["a", "c", "b"]);
    expect(filterAndSortAggregates(items, "", "all", "votes_desc").map(id)).toEqual(["b", "c", "a"]);
  });
});

function id(item: AdminAggregate): string { return item.record.databaseId; }

function aggregate(databaseId: string, databaseName: string, votes: number): AdminAggregate {
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
    finalDecision: null,
    completionStatus: votes ? "reviewed" : "unreviewed"
  };
}
