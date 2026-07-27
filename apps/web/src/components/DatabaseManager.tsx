import { useEffect, useMemo, useState } from "react";
import { adminGetDatabaseRecords, adminUpdateDatabaseStatus } from "../api";
import type { AdminDatabaseRecord } from "../types";

type Props = {
  adminToken: string;
};

export function DatabaseManager({ adminToken }: Props) {
  const [records, setRecords] = useState<AdminDatabaseRecord[]>([]);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState("");
  const [status, setStatus] = useState("");

  const filteredRecords = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return records;
    return records.filter(
      (record) =>
        record.databaseName.toLowerCase().includes(normalized) ||
        record.databaseId.toLowerCase().includes(normalized)
    );
  }, [query, records]);

  async function load() {
    if (!adminToken) {
      setRecords([]);
      return;
    }
    try {
      setStatus("Loading databases...");
      const result = await adminGetDatabaseRecords(adminToken);
      setRecords(result.records);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load databases.");
    }
  }

  async function setActive(record: AdminDatabaseRecord, active: boolean) {
    if (
      !active &&
      !window.confirm(
        `Deactivate ${record.databaseName}? It will disappear from reviewer queues and exports, but saved feedback will be retained.`
      )
    ) {
      return;
    }
    try {
      setBusyId(record.databaseId);
      setStatus(active ? "Reactivating database..." : "Deactivating database...");
      const result = await adminUpdateDatabaseStatus(adminToken, record.databaseId, active);
      setRecords((current) =>
        current.map((item) => (item.databaseId === result.record.databaseId ? result.record : item))
      );
      setStatus(active ? "Database reactivated." : "Database deactivated. Saved feedback was retained.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update database status.");
    } finally {
      setBusyId("");
    }
  }

  useEffect(() => {
    void load();
  }, [adminToken]);

  const activeCount = records.filter((record) => record.active).length;

  return (
    <div className="bg-white border rounded-2 p-4">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
        <div>
          <h2 className="h5 mb-1">Databases</h2>
          <div className="text-secondary">
            {activeCount} active · {records.length - activeCount} inactive
          </div>
        </div>
        <button className="btn btn-sm btn-outline-primary" disabled={!adminToken} onClick={() => void load()}>
          Refresh
        </button>
      </div>
      <div className="mt-3">
        <label className="form-label w-100">
          Find a database
          <input
            className="form-control"
            type="search"
            value={query}
            placeholder="Search by name or ID"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      {status && <div className="alert alert-info py-2">{status}</div>}
      <div className="table-responsive mt-3">
        <table className="table table-sm table-striped align-middle">
          <thead>
            <tr>
              <th>Database</th>
              <th>ID</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record) => (
              <tr key={record.databaseId}>
                <td>{record.databaseName}</td>
                <td>{record.databaseId}</td>
                <td>
                  <span className={`badge ${record.active ? "text-bg-success" : "text-bg-secondary"}`}>
                    {record.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <button
                    className={`btn btn-sm ${record.active ? "btn-outline-danger" : "btn-outline-success"}`}
                    disabled={!adminToken || busyId === record.databaseId}
                    onClick={() => void setActive(record, !record.active)}
                  >
                    {record.active ? "Deactivate" : "Reactivate"}
                  </button>
                </td>
              </tr>
            ))}
            {filteredRecords.length === 0 && (
              <tr>
                <td colSpan={4} className="text-secondary">
                  No databases found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
