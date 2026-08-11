import type { AdminDatabaseRecord } from "../types";

export type DatabaseManagerFilters = {
  query: string;
  status: "all" | "active" | "inactive";
  assignment: string;
  votes: "all" | "none" | "some";
};

export function filterDatabaseRecords(
  records: AdminDatabaseRecord[],
  filters: DatabaseManagerFilters
): AdminDatabaseRecord[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return records.filter((record) => {
    const matchesQuery = !query
      || record.databaseName.toLocaleLowerCase().includes(query)
      || record.databaseId.toLocaleLowerCase().includes(query);
    const matchesStatus = filters.status === "all"
      || (filters.status === "active" ? record.active : !record.active);
    const matchesVotes = filters.votes === "all"
      || (filters.votes === "none" ? record.voteCount === 0 : record.voteCount > 0);
    const matchesAssignment = filters.assignment === "all"
      || (filters.assignment === "unassigned" && !record.assignedAdminId)
      || (filters.assignment === "assigned" && Boolean(record.assignedAdminId))
      || (filters.assignment.startsWith("admin:") && record.assignedAdminId === filters.assignment.slice(6));
    return matchesQuery && matchesStatus && matchesVotes && matchesAssignment;
  });
}
