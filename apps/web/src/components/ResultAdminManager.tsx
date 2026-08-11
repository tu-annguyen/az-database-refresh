import { useEffect, useState } from "react";
import {
  adminCreateResultAdmin,
  adminDeactivateResultAdmin,
  adminGetResultAdmins,
  adminRegenerateResultAdminLink,
  adminUpdateResultAdmin
} from "../api";
import type { ResultAdmin } from "../types";

type Props = { adminToken: string };
type Draft = { name: string; email: string };

export function ResultAdminManager({ adminToken }: Props) {
  const [admins, setAdmins] = useState<ResultAdmin[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [createdLink, setCreatedLink] = useState("");
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load() {
    if (!adminToken) return apply([]);
    try {
      const result = await adminGetResultAdmins(adminToken);
      apply(result.admins);
      setStatus("");
    } catch (error) {
      setStatus(message(error, "Unable to load admins."));
    }
  }

  async function create() {
    try {
      setBusyId("new");
      const result = await adminCreateResultAdmin(adminToken, name.trim(), email.trim());
      upsert(result.admin);
      setCreatedLink(absoluteUrl(result.admin.adminReviewUrlPath ?? result.adminReviewUrlPath));
      setName("");
      setEmail("");
      setStatus("Admin review link created.");
    } catch (error) {
      setStatus(message(error, "Unable to create admin."));
    } finally {
      setBusyId("");
    }
  }

  async function save(admin: ResultAdmin) {
    const draft = drafts[admin.id] ?? toDraft(admin);
    await run(admin.id, "Admin saved.", async () => {
      const result = await adminUpdateResultAdmin(adminToken, admin.id, draft.name.trim(), draft.email.trim());
      upsert(result.admin);
    });
  }

  async function deactivate(admin: ResultAdmin) {
    if (!window.confirm(`Deactivate ${admin.name}'s link and clear all of their database assignments?`)) return;
    await run(admin.id, "Admin deactivated and assignments cleared.", async () => {
      const result = await adminDeactivateResultAdmin(adminToken, admin.id);
      upsert(result.admin);
    });
  }

  async function regenerate(admin: ResultAdmin) {
    await run(admin.id, "Admin review link regenerated.", async () => {
      const result = await adminRegenerateResultAdminLink(adminToken, admin.id);
      upsert(result.admin);
      setCreatedLink(absoluteUrl(result.admin.adminReviewUrlPath ?? result.adminReviewUrlPath));
    });
  }

  async function run(id: string, success: string, action: () => Promise<void>) {
    try {
      setBusyId(id);
      await action();
      setStatus(success);
    } catch (error) {
      setStatus(message(error, "Unable to update admin."));
    } finally {
      setBusyId("");
    }
  }

  function apply(next: ResultAdmin[]) {
    setAdmins(next);
    setDrafts(Object.fromEntries(next.map((admin) => [admin.id, toDraft(admin)])));
  }

  function upsert(next: ResultAdmin) {
    setAdmins((current) => current.some(({ id }) => id === next.id)
      ? current.map((admin) => admin.id === next.id ? next : admin)
      : [next, ...current]);
    setDrafts((current) => ({ ...current, [next.id]: toDraft(next) }));
  }

  function updateDraft(id: string, field: keyof Draft, value: string) {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? { name: "", email: "" }), [field]: value } }));
  }

  useEffect(() => { void load(); }, [adminToken]);

  return (
    <div className="bg-white border rounded-2 p-4">
      <h2 className="h5">Admins</h2>
      <p className="text-secondary">Create scoped links for admins who will finalize assigned database results.</p>
      <div className="row g-2 align-items-end mb-3">
        <div className="col-md-5"><label className="form-label w-100">Name<input className="form-control" value={name} onChange={(e) => setName(e.target.value)} /></label></div>
        <div className="col-md-5"><label className="form-label w-100">Email<input className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label></div>
        <div className="col-md-2"><button className="btn btn-primary w-100" disabled={!adminToken || !name.trim() || !email.trim() || Boolean(busyId)} onClick={() => void create()}>Create</button></div>
      </div>
      {status && <div className="alert alert-info py-2">{status}</div>}
      {createdLink && <label className="form-label w-100">New admin review link<input className="form-control" readOnly value={createdLink} onFocus={(e) => e.currentTarget.select()} /></label>}
      <div className="table-responsive mt-3">
        <table className="table table-sm table-striped align-middle">
          <thead><tr><th>Name</th><th>Email</th><th>Admin link</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {admins.map((admin) => {
              const draft = drafts[admin.id] ?? toDraft(admin);
              const changed = draft.name !== admin.name || draft.email !== admin.email;
              return <tr key={admin.id}>
                <td><input className="form-control form-control-sm" value={draft.name} onChange={(e) => updateDraft(admin.id, "name", e.target.value)} /></td>
                <td><input className="form-control form-control-sm" type="email" value={draft.email} onChange={(e) => updateDraft(admin.id, "email", e.target.value)} /></td>
                <td className="reviewer-link-cell">{admin.adminReviewUrlPath ? <input className="form-control form-control-sm" readOnly value={absoluteUrl(admin.adminReviewUrlPath)} onFocus={(e) => e.currentTarget.select()} /> : <span className="text-secondary">No active link</span>}</td>
                <td><span className={`badge ${admin.active ? "text-bg-success" : "text-bg-secondary"}`}>{admin.active ? "Active" : "Inactive"}</span></td>
                <td><div className="d-flex flex-wrap gap-1">
                  <button className="btn btn-sm btn-outline-primary" disabled={!changed || !draft.name.trim() || !draft.email.trim() || Boolean(busyId)} onClick={() => void save(admin)}>Save</button>
                  <button className="btn btn-sm btn-outline-secondary" disabled={!adminToken || Boolean(busyId)} onClick={() => void regenerate(admin)}>Regenerate</button>
                  <button className="btn btn-sm btn-outline-danger" disabled={!admin.active || Boolean(busyId)} onClick={() => void deactivate(admin)}>Deactivate</button>
                </div></td>
              </tr>;
            })}
            {admins.length === 0 && <tr><td colSpan={5} className="text-secondary">No admins found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function toDraft(admin: ResultAdmin): Draft { return { name: admin.name, email: admin.email }; }
function absoluteUrl(path: string | null | undefined): string { return path ? `${window.location.origin}${path}` : ""; }
function message(error: unknown, fallback: string): string { return error instanceof Error ? error.message : fallback; }
