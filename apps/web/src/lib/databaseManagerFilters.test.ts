import { describe, expect, it } from "vitest";
import { filterDatabaseRecords, type DatabaseManagerFilters } from "./databaseManagerFilters";
import type { AdminDatabaseRecord } from "../types";

const records: AdminDatabaseRecord[] = [
  { databaseId: "alpha", databaseName: "Alpha", active: true, voteCount: 0, assignedAdminId: null, assignedAdminName: null },
  { databaseId: "beta", databaseName: "Beta", active: true, voteCount: 2, assignedAdminId: "admin-1", assignedAdminName: "Ada" },
  { databaseId: "gamma", databaseName: "Gamma", active: false, voteCount: 1, assignedAdminId: "admin-2", assignedAdminName: "Grace" }
];

const defaults: DatabaseManagerFilters = { query: "", status: "all", assignment: "all", votes: "all" };

describe("filterDatabaseRecords", () => {
  it("searches names and IDs case-insensitively", () => {
    expect(filterDatabaseRecords(records, { ...defaults, query: "BETA" }).map(({ databaseId }) => databaseId)).toEqual(["beta"]);
  });

  it("combines status, assignment, and vote filters", () => {
    expect(filterDatabaseRecords(records, { ...defaults, status: "active", assignment: "assigned", votes: "some" }))
      .toEqual([records[1]]);
    expect(filterDatabaseRecords(records, { ...defaults, assignment: "admin:admin-2" })).toEqual([records[2]]);
    expect(filterDatabaseRecords(records, { ...defaults, assignment: "unassigned", votes: "none" })).toEqual([records[0]]);
  });
});
