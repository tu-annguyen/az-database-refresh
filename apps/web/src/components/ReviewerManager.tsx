import { useEffect, useState } from "react";
import {
  adminCreateReviewer,
  adminDeleteReviewer,
  adminGetReviewers,
  adminRegenerateReviewerLink,
  adminUpdateReviewer
} from "../api";
import type { Reviewer } from "../types";

type Props = {
  adminToken: string;
};

type ReviewerDraft = {
  name: string;
  email: string;
};

export function ReviewerManager({ adminToken }: Props) {
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewerDraft>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [createdLink, setCreatedLink] = useState("");
  const [status, setStatus] = useState("");
  const [busyReviewerId, setBusyReviewerId] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    if (!adminToken) {
      applyReviewers([]);
      return;
    }
    try {
      const result = await adminGetReviewers(adminToken);
      applyReviewers(result.reviewers);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load reviewers.");
    }
  }

  async function createReviewer() {
    try {
      setCreating(true);
      setStatus("Creating reviewer...");
      const result = await adminCreateReviewer(adminToken, name, email);
      const reviewer = result.reviewer;
      upsertReviewer(reviewer);
      setCreatedLink(absoluteReviewUrl(reviewer.reviewUrlPath ?? result.reviewUrlPath));
      setName("");
      setEmail("");
      setStatus("Reviewer link created.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create reviewer.");
    } finally {
      setCreating(false);
    }
  }

  async function saveReviewer(reviewer: Reviewer) {
    const draft = drafts[reviewer.id] ?? reviewerDraft(reviewer);
    try {
      setBusyReviewerId(reviewer.id);
      setStatus("Saving reviewer...");
      const result = await adminUpdateReviewer(adminToken, reviewer.id, draft.name, draft.email);
      upsertReviewer(result.reviewer);
      setStatus("Reviewer saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save reviewer.");
    } finally {
      setBusyReviewerId("");
    }
  }

  async function deactivateReviewer(reviewer: Reviewer) {
    if (!window.confirm(`Deactivate ${reviewer.name}'s reviewer link?`)) return;
    try {
      setBusyReviewerId(reviewer.id);
      setStatus("Deactivating reviewer...");
      const result = await adminDeleteReviewer(adminToken, reviewer.id);
      upsertReviewer(result.reviewer);
      setStatus("Reviewer deactivated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to deactivate reviewer.");
    } finally {
      setBusyReviewerId("");
    }
  }

  async function regenerateLink(reviewer: Reviewer) {
    try {
      setBusyReviewerId(reviewer.id);
      setStatus("Regenerating reviewer link...");
      const result = await adminRegenerateReviewerLink(adminToken, reviewer.id);
      upsertReviewer(result.reviewer);
      setCreatedLink(absoluteReviewUrl(result.reviewer.reviewUrlPath ?? result.reviewUrlPath));
      setStatus("Reviewer link regenerated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to regenerate reviewer link.");
    } finally {
      setBusyReviewerId("");
    }
  }

  function applyReviewers(nextReviewers: Reviewer[]) {
    setReviewers(nextReviewers);
    setDrafts(Object.fromEntries(nextReviewers.map((reviewer) => [reviewer.id, reviewerDraft(reviewer)])));
  }

  function updateDraft(reviewerId: string, field: keyof ReviewerDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [reviewerId]: {
        ...(current[reviewerId] ?? { name: "", email: "" }),
        [field]: value
      }
    }));
  }

  function upsertReviewer(nextReviewer: Reviewer) {
    setReviewers((current) =>
      current.some((reviewer) => reviewer.id === nextReviewer.id)
        ? current.map((reviewer) => (reviewer.id === nextReviewer.id ? nextReviewer : reviewer))
        : [nextReviewer, ...current]
    );
    setDrafts((current) => ({ ...current, [nextReviewer.id]: reviewerDraft(nextReviewer) }));
  }

  useEffect(() => {
    void load();
  }, [adminToken]);

  return (
    <div className="bg-white border rounded-2 p-4">
      <h2 className="h5">Reviewers</h2>
      <div className="row g-2 align-items-end mb-3">
        <div className="col-md-5">
          <label className="form-label">
            Name
            <input className="form-control" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
        </div>
        <div className="col-md-5">
          <label className="form-label">
            Email
            <input className="form-control" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
        </div>
        <div className="col-md-2">
          <button
            className="btn btn-primary w-100"
            disabled={!adminToken || !name || !email || creating}
            onClick={() => void createReviewer()}
          >
            Create
          </button>
        </div>
      </div>
      {status && <div className="alert alert-info py-2">{status}</div>}
      {createdLink && (
        <label className="form-label w-100">
          New review link
          <input className="form-control" readOnly value={createdLink} onFocus={(event) => event.currentTarget.select()} />
        </label>
      )}
      <div className="table-responsive mt-3">
        <table className="table table-sm table-striped">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Reviewer link</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reviewers.map((reviewer) => (
              <ReviewerRow
                key={reviewer.id}
                reviewer={reviewer}
                draft={drafts[reviewer.id] ?? reviewerDraft(reviewer)}
                busy={busyReviewerId === reviewer.id}
                canUseAdminActions={Boolean(adminToken)}
                onDraftChange={updateDraft}
                onSave={saveReviewer}
                onDeactivate={deactivateReviewer}
                onRegenerateLink={regenerateLink}
              />
            ))}
            {reviewers.length === 0 && (
              <tr>
                <td colSpan={5} className="text-secondary">
                  No reviewers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type ReviewerRowProps = {
  reviewer: Reviewer;
  draft: ReviewerDraft;
  busy: boolean;
  canUseAdminActions: boolean;
  onDraftChange: (reviewerId: string, field: keyof ReviewerDraft, value: string) => void;
  onSave: (reviewer: Reviewer) => void;
  onDeactivate: (reviewer: Reviewer) => void;
  onRegenerateLink: (reviewer: Reviewer) => void;
};

function ReviewerRow({
  reviewer,
  draft,
  busy,
  canUseAdminActions,
  onDraftChange,
  onSave,
  onDeactivate,
  onRegenerateLink
}: ReviewerRowProps) {
  const reviewerLink = absoluteReviewUrl(reviewer.reviewUrlPath);
  const hasChanges = draft.name !== reviewer.name || draft.email !== reviewer.email;
  const canSave = canUseAdminActions && draft.name.length > 0 && draft.email.length > 0 && hasChanges && !busy;
  const active = reviewer.active !== false;

  return (
    <tr>
      <td>
        <input
          className="form-control form-control-sm"
          value={draft.name}
          onChange={(event) => onDraftChange(reviewer.id, "name", event.target.value)}
        />
      </td>
      <td>
        <input
          className="form-control form-control-sm"
          type="email"
          value={draft.email}
          onChange={(event) => onDraftChange(reviewer.id, "email", event.target.value)}
        />
      </td>
      <td className="reviewer-link-cell">
        {reviewerLink ? (
          <input
            className="form-control form-control-sm"
            readOnly
            value={reviewerLink}
            onFocus={(event) => event.currentTarget.select()}
          />
        ) : (
          <span className="text-secondary">No active link</span>
        )}
      </td>
      <td>
        <span className={`badge ${active ? "text-bg-success" : "text-bg-secondary"}`}>{active ? "Active" : "Inactive"}</span>
      </td>
      <td>
        <div className="d-flex flex-wrap gap-1">
          <button className="btn btn-sm btn-outline-primary" disabled={!canSave} onClick={() => onSave(reviewer)}>
            Save
          </button>
          <button
            className="btn btn-sm btn-outline-secondary"
            disabled={!canUseAdminActions || busy}
            onClick={() => onRegenerateLink(reviewer)}
          >
            Regenerate
          </button>
          <button
            className="btn btn-sm btn-outline-danger"
            disabled={!canUseAdminActions || busy || !active}
            onClick={() => onDeactivate(reviewer)}
          >
            Deactivate
          </button>
        </div>
      </td>
    </tr>
  );
}

function reviewerDraft(reviewer: Reviewer): ReviewerDraft {
  return { name: reviewer.name, email: reviewer.email };
}

function absoluteReviewUrl(path: string | null | undefined): string {
  return path ? `${window.location.origin}${path}` : "";
}
