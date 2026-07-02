import { useState } from "react";
import type { ImportCommit } from "@az-refresh/shared";
import { adminCommitImport, adminValidateImport } from "../api";
import { parseImportFile } from "../lib/files";

type Props = {
  adminToken: string;
};

export function AdminImportPanel({ adminToken }: Props) {
  const [payload, setPayload] = useState<ImportCommit | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [status, setStatus] = useState("");

  async function handleFile(file: File) {
    setStatus("Parsing file...");
    const parsed = await parseImportFile(file);
    setPayload(parsed.payload);
    setErrors(parsed.errors);
    setWarnings(parsed.warnings);
    setSubjects(parsed.subjects);
    setStatus(`Parsed ${parsed.payload.records.length} records.`);
  }

  async function validateServer() {
    if (!payload) return;
    setStatus("Validating with API...");
    const result = await adminValidateImport(adminToken, payload);
    setErrors(result.errors);
    setWarnings(result.warnings);
    setSubjects(result.subjects);
    setStatus("Server validation complete.");
  }

  async function commit() {
    if (!payload) return;
    setStatus("Committing import...");
    const result = await adminCommitImport(adminToken, payload);
    setStatus(`Import committed as batch ${result.batchId}.`);
  }

  return (
    <div className="bg-white border rounded-2 p-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div>
          <h2 className="h5 mb-1">Import data</h2>
          <div className="text-secondary">Upload the Springshare workbook or flat CSV.</div>
        </div>
        <input
          className="form-control w-auto"
          type="file"
          accept=".xlsx,.csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>

      {payload && (
        <div className="row g-3 mb-3">
          <Metric label="Records" value={payload.records.length} />
          <Metric label="Subjects" value={subjects.length} />
          <Metric label="Errors" value={errors.length} />
          <Metric label="Warnings" value={warnings.length} />
        </div>
      )}

      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-outline-primary" disabled={!payload || !adminToken} onClick={() => void validateServer()}>
          Validate with API
        </button>
        <button className="btn btn-primary" disabled={!payload || errors.length > 0 || !adminToken} onClick={() => void commit()}>
          Commit active import
        </button>
      </div>

      {status && <div className="alert alert-info py-2">{status}</div>}
      <MessageList title="Errors" variant="danger" messages={errors} />
      <MessageList title="Warnings" variant="warning" messages={warnings.slice(0, 30)} />

      {payload && (
        <div className="table-responsive mt-4">
          <table className="table table-sm table-striped align-middle">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Subjects</th>
                <th>A</th>
                <th>B</th>
              </tr>
            </thead>
            <tbody>
              {payload.records.slice(0, 20).map((record) => (
                <tr key={record.databaseId}>
                  <td>{record.databaseId}</td>
                  <td>{record.databaseName}</td>
                  <td>{record.associatedSubjects.join("; ")}</td>
                  <td>{record.rewrittenDescriptionAHtml ? "yes" : "blank"}</td>
                  <td>{record.rewrittenDescriptionBHtml ? "yes" : "blank"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="col-6 col-md-3">
      <div className="border rounded-2 p-3">
        <div className="text-secondary small">{label}</div>
        <div className="h4 mb-0">{value}</div>
      </div>
    </div>
  );
}

function MessageList({ title, messages, variant }: { title: string; messages: string[]; variant: string }) {
  if (!messages.length) return null;
  return (
    <div className={`alert alert-${variant}`}>
      <strong>{title}</strong>
      <ul className="mb-0 mt-2">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}
