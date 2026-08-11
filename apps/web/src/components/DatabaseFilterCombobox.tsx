import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { AdminAggregate } from "../types";
import { filterAndSortAggregates, type ResultSort, type ResultVoteFilter } from "../lib/resultFilters";

type Props = {
  aggregates: AdminAggregate[];
  selectedId: string | undefined;
  onSelect: (databaseId: string) => void;
};

export function DatabaseFilterCombobox({ aggregates, selectedId, onSelect }: Props) {
  const inputId = useId();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ResultSort>("name");
  const [voteFilter, setVoteFilter] = useState<ResultVoteFilter>("all");
  const matches = useMemo(
    () => filterAndSortAggregates(aggregates, query, voteFilter, sort),
    [aggregates, query, sort, voteFilter]
  );

  useEffect(() => {
    if (matches.length === 0 && selectedId) {
      onSelect("");
    } else if (matches.length > 0 && !matches.some((item) => item.record.databaseId === selectedId)) {
      onSelect(matches[0]!.record.databaseId);
    }
  }, [matches, onSelect, selectedId]);

  function clear() {
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <div>
      <label className="visually-hidden" htmlFor={inputId}>
        Filter databases
      </label>
      <div className="input-group input-group-sm mb-2">
        <input
          ref={inputRef}
          id={inputId}
          className="form-control"
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded="true"
          placeholder="Filter by name or ID"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) clear();
          }}
        />
        <button
          className="btn btn-outline-secondary"
          type="button"
          disabled={!query}
          aria-label="Clear database filter"
          onClick={clear}
        >
          Clear
        </button>
      </div>
      <div className="row g-2 mb-2">
        <div className="col-6">
          <label className="form-label small mb-0">Sort
            <select className="form-select form-select-sm" value={sort} onChange={(event) => setSort(event.target.value as ResultSort)}>
              <option value="name">Name A–Z</option>
              <option value="votes_asc">Votes: low to high</option>
              <option value="votes_desc">Votes: high to low</option>
            </select>
          </label>
        </div>
        <div className="col-6">
          <label className="form-label small mb-0">Votes
            <select className="form-select form-select-sm" value={voteFilter} onChange={(event) => setVoteFilter(event.target.value as ResultVoteFilter)}>
              <option value="all">All</option>
              <option value="none">No votes</option>
              <option value="some">Has votes</option>
            </select>
          </label>
        </div>
      </div>
      <div id={listboxId} className="list-group overflow-auto" style={{ maxHeight: "58vh" }} role="listbox">
        {matches.map((item) => (
          <button
            key={item.record.databaseId}
            className={`list-group-item list-group-item-action ${selectedId === item.record.databaseId ? "active" : ""}`}
            type="button"
            role="option"
            aria-selected={selectedId === item.record.databaseId}
            onClick={() => onSelect(item.record.databaseId)}
          >
            <div className="fw-semibold">{item.record.databaseName}</div>
            <div className="small">
              Votes: {item.reviews.length} · {item.finalDecision?.finalized ? "finalized" : "open"}
            </div>
          </button>
        ))}
        {matches.length === 0 && <div className="list-group-item text-secondary">No matching databases</div>}
      </div>
    </div>
  );
}
