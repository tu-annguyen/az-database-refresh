import { useEffect, useMemo, useRef, useState } from "react";
import {
  adminGetDatabaseRecords,
  adminGetResultAdmins,
  adminUpdateDatabaseAssignments,
  adminUpdateDatabaseName,
  adminUpdateDatabaseStatus
} from "../api";
import { filterDatabaseRecords, type DatabaseManagerFilters } from "../lib/databaseManagerFilters";
import { updateDatabaseSelection } from "../lib/databaseSelection";
import type { AdminDatabaseRecord, ResultAdmin } from "../types";

type Props = { adminToken: string };

const INITIAL_FILTERS: DatabaseManagerFilters = {
  query: "",
  status: "all",
  assignment: "all",
  votes: "all"
};

export function DatabaseManager({ adminToken }: Props) {
  const [records, setRecords] = useState<AdminDatabaseRecord[]>([]);
  const [admins, setAdmins] = useState<ResultAdmin[]>([]);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [bulkAdminId, setBulkAdminId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draftName, setDraftName] = useState("");
  const [status, setStatus] = useState("");

  const filteredRecords = useMemo(() => filterDatabaseRecords(records, filters), [filters, records]);
  const visibleIds = filteredRecords.map((record) => record.databaseId);
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;
  const activeAdmins = admins.filter((admin) => admin.active);

  async function load() {
    if (!adminToken) {
      setRecords([]);
      setAdmins([]);
      return;
    }
    try {
      setStatus("Loading databases...");
      const [recordResult, adminResult] = await Promise.all([
        adminGetDatabaseRecords(adminToken),
        adminGetResultAdmins(adminToken)
      ]);
      setRecords(recordResult.records);
      setAdmins(adminResult.admins);
      setSelectedIds((current) => new Set([...current].filter((id) => recordResult.records.some((record) => record.databaseId === id))));
      setLastSelectedId((current) => current && recordResult.records.some((record) => record.databaseId === current) ? current : null);
      setStatus("");
    } catch (error) {
      setStatus(message(error, "Unable to load databases."));
    }
  }

  async function setActive(record: AdminDatabaseRecord, active: boolean) {
    if (!active && !window.confirm(`Deactivate ${record.databaseName}? Saved feedback and its admin assignment will be retained.`)) return;
    await run(record.databaseId, active ? "Database reactivated." : "Database deactivated.", async () => {
      const result = await adminUpdateDatabaseStatus(adminToken, record.databaseId, active);
      replaceRecord(result.record);
    });
  }

  async function assign(databaseIds: string[], adminId: string | null, confirmReplacement: boolean) {
    const replacements = records.filter((record) =>
      databaseIds.includes(record.databaseId) && record.assignedAdminId && record.assignedAdminId !== adminId
    );
    if (confirmReplacement && replacements.length > 0
      && !window.confirm(`Replace existing admin assignments for ${replacements.length} selected database${replacements.length === 1 ? "" : "s"}?`)) return;
    await run("assignment", adminId ? "Database assignment saved." : "Database assignment cleared.", async () => {
      const result = await adminUpdateDatabaseAssignments(adminToken, databaseIds, adminId);
      setRecords(result.records);
      if (confirmReplacement) {
        setSelectedIds(new Set());
        setLastSelectedId(null);
      }
    });
  }

  async function saveName(record: AdminDatabaseRecord) {
    const databaseName = draftName.trim();
    if (!databaseName || databaseName === record.databaseName) return;
    await run(record.databaseId, "Database name saved.", async () => {
      const result = await adminUpdateDatabaseName(adminToken, record.databaseId, databaseName);
      replaceRecord(result.record);
      cancelEditing();
    });
  }

  async function run(id: string, success: string, action: () => Promise<void>) {
    try {
      setBusyId(id);
      await action();
      setStatus(success);
    } catch (error) {
      setStatus(message(error, "Unable to update databases."));
    } finally {
      setBusyId("");
    }
  }

  function replaceRecord(next: AdminDatabaseRecord) {
    setRecords((current) => current.map((record) => record.databaseId === next.databaseId ? next : record));
  }

  function setFilter<K extends keyof DatabaseManagerFilters>(key: K, value: DatabaseManagerFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function toggleVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
    setLastSelectedId(null);
  }

  function toggleRow(id: string, checked: boolean, shiftKey: boolean) {
    const hasVisibleAnchor = Boolean(lastSelectedId && visibleIds.includes(lastSelectedId));
    setSelectedIds((current) => updateDatabaseSelection(
      current,
      visibleIds,
      lastSelectedId,
      id,
      checked,
      shiftKey
    ));
    if (!shiftKey || !hasVisibleAnchor) setLastSelectedId(id);
  }

  function clearSelection() { setSelectedIds(new Set()); setLastSelectedId(null); }

  function startEditing(record: AdminDatabaseRecord) {
    setEditingId(record.databaseId);
    setDraftName(record.databaseName);
  }

  function cancelEditing() { setEditingId(""); setDraftName(""); }

  useEffect(() => { void load(); }, [adminToken]);
  const activeCount = records.filter((record) => record.active).length;

  return (
    <div className="bg-white border rounded-2 p-4">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
        <div><h2 className="h5 mb-1">Databases</h2><div className="text-secondary">{activeCount} active · {records.length - activeCount} inactive</div></div>
        <button className="btn btn-sm btn-outline-primary" disabled={!adminToken || Boolean(busyId)} onClick={() => void load()}>Refresh</button>
      </div>

      <div className="row g-2 mt-2">
        <div className="col-lg-5"><label className="form-label w-100">Find a database<input className="form-control" type="search" value={filters.query} placeholder="Search by name or ID" onChange={(e) => setFilter("query", e.target.value)} /></label></div>
        <FilterSelect label="Status" value={filters.status} onChange={(value) => setFilter("status", value as DatabaseManagerFilters["status"])} options={[["all", "All"], ["active", "Active"], ["inactive", "Inactive"]]} />
        <FilterSelect label="Votes" value={filters.votes} onChange={(value) => setFilter("votes", value as DatabaseManagerFilters["votes"])} options={[["all", "All"], ["none", "No votes"], ["some", "Has votes"]]} />
        <div className="col-lg-3"><label className="form-label w-100">Assignment<select className="form-select" value={filters.assignment} onChange={(e) => setFilter("assignment", e.target.value)}><option value="all">All</option><option value="unassigned">Unassigned</option><option value="assigned">Any assigned</option>{admins.map((admin) => <option key={admin.id} value={`admin:${admin.id}`}>{admin.name}{admin.active ? "" : " (inactive)"}</option>)}</select></label></div>
      </div>

      {selectedIds.size > 0 && <div className="border rounded-2 bg-light p-3 my-2 d-flex flex-wrap gap-2 align-items-end">
        <div className="me-auto"><strong>{selectedIds.size} selected</strong><div className="small text-secondary">Assignments apply to selected rows, including selections hidden by filters.</div></div>
        <label className="form-label mb-0">Assign to<select className="form-select form-select-sm" value={bulkAdminId} onChange={(e) => setBulkAdminId(e.target.value)}><option value="">Unassigned</option>{activeAdmins.map((admin) => <option key={admin.id} value={admin.id}>{admin.name}</option>)}</select></label>
        <button className="btn btn-sm btn-primary" disabled={Boolean(busyId)} onClick={() => void assign([...selectedIds], bulkAdminId || null, true)}>Apply</button>
        <button className="btn btn-sm btn-outline-secondary" disabled={Boolean(busyId)} onClick={clearSelection}>Clear selection</button>
      </div>}

      {status && <div className="alert alert-info py-2">{status}</div>}
      <div className="small text-secondary mt-2">Tip: Shift-click a row checkbox to select or clear the visible range from your last selection.</div>
      <div className="table-responsive mt-3">
        <table className="table table-sm table-striped align-middle">
          <thead><tr><th><SelectAllCheckbox checked={allVisibleSelected} indeterminate={someVisibleSelected} disabled={visibleIds.length === 0 || Boolean(busyId)} onChange={toggleVisible} /></th><th>Database</th><th>ID</th><th>Votes</th><th>Assigned admin</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filteredRecords.map((record) => <tr key={record.databaseId}>
              <td><input className="form-check-input" type="checkbox" aria-label={`Select ${record.databaseName}`} title="Shift-click to select a range" checked={selectedIds.has(record.databaseId)} disabled={Boolean(busyId)} onChange={(event) => toggleRow(record.databaseId, event.target.checked, "shiftKey" in event.nativeEvent && Boolean(event.nativeEvent.shiftKey))} /></td>
              <td>{editingId === record.databaseId ? <input className="form-control form-control-sm" autoFocus maxLength={255} value={draftName} onChange={(e) => setDraftName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void saveName(record); if (e.key === "Escape") cancelEditing(); }} /> : record.databaseName}</td>
              <td>{record.databaseId}</td><td>{record.voteCount}</td>
              <td><select className="form-select form-select-sm" aria-label={`Assigned admin for ${record.databaseName}`} value={record.assignedAdminId ?? ""} disabled={!adminToken || Boolean(busyId)} onChange={(e) => void assign([record.databaseId], e.target.value || null, false)}><option value="">Unassigned</option>{admins.filter((admin) => admin.active || admin.id === record.assignedAdminId).map((admin) => <option key={admin.id} value={admin.id}>{admin.name}{admin.active ? "" : " (inactive)"}</option>)}</select></td>
              <td><span className={`badge ${record.active ? "text-bg-success" : "text-bg-secondary"}`}>{record.active ? "Active" : "Inactive"}</span></td>
              <td><div className="d-flex flex-wrap gap-1">{editingId === record.databaseId ? <><button className="btn btn-sm btn-primary" disabled={Boolean(busyId) || !draftName.trim() || draftName.trim() === record.databaseName} onClick={() => void saveName(record)}>Save</button><button className="btn btn-sm btn-outline-secondary" disabled={Boolean(busyId)} onClick={cancelEditing}>Cancel</button></> : <button className="btn btn-sm btn-outline-primary" disabled={Boolean(busyId)} onClick={() => startEditing(record)}>Edit name</button>}<button className={`btn btn-sm ${record.active ? "btn-outline-danger" : "btn-outline-success"}`} disabled={Boolean(busyId) || editingId === record.databaseId} onClick={() => void setActive(record, !record.active)}>{record.active ? "Deactivate" : "Reactivate"}</button></div></td>
            </tr>)}
            {filteredRecords.length === 0 && <tr><td colSpan={7} className="text-secondary">No databases found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return <div className="col-lg-2"><label className="form-label w-100">{label}<select className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label></div>;
}

function SelectAllCheckbox({ checked, indeterminate, disabled, onChange }: { checked: boolean; indeterminate: boolean; disabled: boolean; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return <input ref={ref} className="form-check-input" type="checkbox" aria-label="Select all filtered databases" checked={checked} disabled={disabled} onChange={onChange} />;
}

function message(error: unknown, fallback: string): string { return error instanceof Error ? error.message : fallback; }
