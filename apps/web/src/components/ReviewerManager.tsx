import { useEffect, useState } from "react";
import { adminCreateReviewer, adminGetReviewers } from "../api";
import type { Reviewer } from "../types";

type Props = {
  adminToken: string;
};

export function ReviewerManager({ adminToken }: Props) {
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [createdLink, setCreatedLink] = useState("");
  const [status, setStatus] = useState("");

  async function load() {
    if (!adminToken) return;
    const result = await adminGetReviewers(adminToken);
    setReviewers(result.reviewers);
  }

  async function createReviewer() {
    setStatus("Creating reviewer...");
    const result = await adminCreateReviewer(adminToken, name, email);
    setCreatedLink(`${window.location.origin}${result.reviewUrlPath}`);
    setName("");
    setEmail("");
    setStatus("Reviewer link created.");
    await load();
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
            <input className="form-control" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
        </div>
        <div className="col-md-2">
          <button className="btn btn-primary w-100" disabled={!adminToken || !name || !email} onClick={() => void createReviewer()}>
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
            </tr>
          </thead>
          <tbody>
            {reviewers.map((reviewer) => (
              <tr key={reviewer.id}>
                <td>{reviewer.name}</td>
                <td>{reviewer.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
