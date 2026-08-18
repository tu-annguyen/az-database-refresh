import type { AdminAggregate } from "../types";

export type ResultSort = "name" | "votes_asc" | "votes_desc";
export type ResultVoteFilter = "all" | "none" | "some";
export type ResultStatusFilter = "all" | "open" | "finalized";

export function filterAndSortAggregates(
  aggregates: AdminAggregate[],
  query: string,
  voteFilter: ResultVoteFilter,
  statusFilter: ResultStatusFilter,
  sort: ResultSort
): AdminAggregate[] {
  const normalized = query.trim().toLocaleLowerCase();
  return aggregates
    .filter((item) => {
      const matchesQuery = !normalized
        || item.record.databaseName.toLocaleLowerCase().includes(normalized)
        || item.record.databaseId.toLocaleLowerCase().includes(normalized);
      const matchesVotes = voteFilter === "all"
        || (voteFilter === "none" ? item.reviews.length === 0 : item.reviews.length > 0);
      const isFinalized = item.finalDecision?.finalized === true;
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "finalized" ? isFinalized : !isFinalized);
      return matchesQuery && matchesVotes && matchesStatus;
    })
    .sort((a, b) => {
      if (sort === "votes_asc") return a.reviews.length - b.reviews.length || byName(a, b);
      if (sort === "votes_desc") return b.reviews.length - a.reviews.length || byName(a, b);
      return byName(a, b);
    });
}

function byName(a: AdminAggregate, b: AdminAggregate): number {
  return a.record.databaseName.localeCompare(b.record.databaseName);
}
