import { useId, useMemo, useState } from "react";
import type { DatabaseOption } from "../types";

type Props = {
  databases: DatabaseOption[];
  selectedIds: string[];
  onChange: (databaseIds: string[]) => void;
};

export function DatabaseCombobox({ databases, selectedIds, onChange }: Props) {
  const inputId = useId();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => selectedIds.map((id) => databases.find((database) => database.databaseId === id)).filter(isDefined),
    [databases, selectedIds]
  );
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return databases
      .filter((database) => !selectedIds.includes(database.databaseId))
      .filter(
        (database) =>
          !normalized ||
          database.databaseName.toLocaleLowerCase().includes(normalized) ||
          database.databaseId.toLocaleLowerCase().includes(normalized)
      )
      .slice(0, 10);
  }, [databases, query, selectedIds]);

  function select(database: DatabaseOption) {
    onChange([...selectedIds, database.databaseId]);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="database-combobox">
      <label className="form-label" htmlFor={inputId}>
        Add individual databases
      </label>
      <div className="position-relative">
        <input
          id={inputId}
          className="form-control"
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          placeholder="Search by database name or ID"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && matches[0]) {
              event.preventDefault();
              select(matches[0]);
            }
            if (event.key === "Escape") setOpen(false);
          }}
        />
        {open && (
          <div id={listboxId} className="database-options list-group position-absolute w-100 shadow-sm" role="listbox">
            {matches.map((database) => (
              <button
                className="list-group-item list-group-item-action text-start"
                key={database.databaseId}
                type="button"
                role="option"
                aria-selected="false"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(database)}
              >
                <span className="d-block">{database.databaseName}</span>
                <span className="small text-secondary">ID {database.databaseId}</span>
              </button>
            ))}
            {!matches.length && <div className="list-group-item text-secondary">No matching databases</div>}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mt-2" aria-label="Selected individual databases">
          {selected.map((database) => (
            <span className="badge text-bg-light border d-inline-flex align-items-center gap-2" key={database.databaseId}>
              {database.databaseName}
              <button
                className="btn-close database-remove"
                type="button"
                aria-label={`Remove ${database.databaseName}`}
                onClick={() => onChange(selectedIds.filter((id) => id !== database.databaseId))}
              />
            </span>
          ))}
        </div>
      )}
      <div className="form-text">These databases are added to those matched by your selected subjects.</div>
    </div>
  );
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
