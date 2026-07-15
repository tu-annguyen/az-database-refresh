import { useId, useMemo, useRef, useState } from "react";
import type { AdminAggregate } from "../types";

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
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return aggregates;

    return aggregates.filter(
      (item) =>
        item.record.databaseName.toLocaleLowerCase().includes(normalized) ||
        item.record.databaseId.toLocaleLowerCase().includes(normalized)
    );
  }, [aggregates, query]);

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
