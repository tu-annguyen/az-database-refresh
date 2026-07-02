import { FINAL_DECISION_LABELS, resolveFinalDescription, type FinalDecision } from "@az-refresh/shared";
import { useEffect, useState } from "react";
import { adminGetAggregates, adminSaveFinalDecision } from "../api";
import {
  downloadAggregateCsv,
  downloadRawReviewsCsv,
  downloadSpringshareWorkbook
} from "../lib/files";
import type { AdminAggregate } from "../types";
import { SafeHtml } from "./SafeHtml";

type Props = {
  adminToken: string;
};

export function AggregationPanel({ adminToken }: Props) {
  const [aggregates, setAggregates] = useState<AdminAggregate[]>([]);
  const [sourceWorkbookBase64, setSourceWorkbookBase64] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [decision, setDecision] = useState<FinalDecision>("use_rewritten_a");
  const [selectedReviewId, setSelectedReviewId] = useState("");
  const [finalHtml, setFinalHtml] = useState("");
  const [finalized, setFinalized] = useState(false);
  const [status, setStatus] = useState("");

  const selected = aggregates.find((item) => item.record.databaseId === selectedId) ?? aggregates[0];

  async function load() {
    if (!adminToken) return;
    setStatus("Loading results...");
    const result = await adminGetAggregates(adminToken);
    setAggregates(result.aggregates);
    setSourceWorkbookBase64(result.activeBatch?.source_workbook_base64 ?? "");
    setSelectedId((current) => current || result.aggregates[0]?.record.databaseId || "");
    setStatus("");
  }

  async function saveDecision() {
    if (!selected) return;
    await adminSaveFinalDecision(adminToken, {
      databaseId: selected.record.databaseId,
      decision,
      selectedReviewId: selectedReviewId || null,
      finalDescriptionHtml: finalHtml,
      finalized
    });
    setStatus("Final decision saved.");
    await load();
  }

  function applyDecision(nextDecision: FinalDecision, reviewId = "") {
    if (!selected) return;
    const review = selected.reviews.find((item) => item.id === reviewId);
    setDecision(nextDecision);
    setSelectedReviewId(reviewId);
    setFinalHtml(resolveFinalDescription(nextDecision, selected.record, finalHtml, review ?? null));
  }

  useEffect(() => {
    void load();
  }, [adminToken]);

  useEffect(() => {
    if (!selected) return;
    const existing = selected.finalDecision;
    setDecision(existing?.decision ?? "use_rewritten_a");
    setSelectedReviewId(existing?.selectedReviewId ?? "");
    setFinalHtml(existing?.finalDescriptionHtml || selected.record.rewrittenDescriptionAHtml);
    setFinalized(existing?.finalized ?? false);
  }, [selected?.record.databaseId]);

  return (
    <div className="row g-4">
      <aside className="col-xl-4">
        <div className="bg-white border rounded-2 p-3">
          <div className="d-flex gap-2 mb-3">
            <button className="btn btn-outline-primary btn-sm" disabled={!adminToken} onClick={() => void load()}>
              Refresh
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => downloadRawReviewsCsv(aggregates)}>
              Raw CSV
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => downloadAggregateCsv(aggregates)}>
              Summary CSV
            </button>
          </div>
          <div className="d-flex gap-2 mb-3">
            <button
              className="btn btn-outline-success btn-sm"
              onClick={() => void downloadSpringshareWorkbook(sourceWorkbookBase64, aggregates, true)}
            >
              Draft XLSX
            </button>
            <button
              className="btn btn-success btn-sm"
              onClick={() => void downloadSpringshareWorkbook(sourceWorkbookBase64, aggregates, false)}
            >
              Final XLSX
            </button>
          </div>
          <div className="list-group overflow-auto" style={{ maxHeight: "70vh" }}>
            {aggregates.map((item) => (
              <button
                key={item.record.databaseId}
                className={`list-group-item list-group-item-action ${selected?.record.databaseId === item.record.databaseId ? "active" : ""}`}
                onClick={() => setSelectedId(item.record.databaseId)}
              >
                <div className="fw-semibold">{item.record.databaseName}</div>
                <div className="small">Votes: {item.reviews.length} · {item.finalDecision?.finalized ? "finalized" : "open"}</div>
              </button>
            ))}
          </div>
        </div>
      </aside>
      <section className="col-xl-8">
        {selected && (
          <div className="bg-white border rounded-2 p-4">
            <h2 className="h5 mb-1">{selected.record.databaseName}</h2>
            <div className="text-secondary small mb-3">ID {selected.record.databaseId}</div>
            <VoteSummary item={selected} />
            <div className="row g-3 mt-1">
              <Description title="Original" html={selected.record.originalDescriptionHtml} onUse={() => applyDecision("use_original")} />
              <Description title="Rewritten A" html={selected.record.rewrittenDescriptionAHtml} onUse={() => applyDecision("use_rewritten_a")} />
              <Description title="Rewritten B" html={selected.record.rewrittenDescriptionBHtml} onUse={() => applyDecision("use_rewritten_b")} />
            </div>
            <h3 className="h6 mt-4">Faculty revisions and comments</h3>
            {selected.reviews.length === 0 && <div className="text-secondary">No faculty reviews yet.</div>}
            {selected.reviews.map((review) => (
              <div className="border rounded-2 p-3 mb-2" key={review.id}>
                <div className="d-flex flex-wrap gap-2 justify-content-between">
                  <strong>{review.choice}</strong>
                  {review.revisedDescriptionHtml && (
                    <button className="btn btn-sm btn-outline-primary" onClick={() => applyDecision("use_faculty_revision", review.id)}>
                      Use revision
                    </button>
                  )}
                </div>
                {review.revisedDescriptionHtml && <SafeHtml html={review.revisedDescriptionHtml} />}
                {review.comments && <p className="mb-0 mt-2">{review.comments}</p>}
              </div>
            ))}
            <div className="row g-3 mt-3">
              <div className="col-md-6">
                <label className="form-label">
                  Final decision
                  <select className="form-select" value={decision} onChange={(event) => applyDecision(event.target.value as FinalDecision, selectedReviewId)}>
                    {(Object.entries(FINAL_DECISION_LABELS) as [FinalDecision, string][]).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="col-md-6 d-flex align-items-end">
                <label className="form-check mb-3">
                  <input className="form-check-input" type="checkbox" checked={finalized} onChange={(event) => setFinalized(event.target.checked)} />
                  <span className="form-check-label">Finalized</span>
                </label>
              </div>
            </div>
            <label className="form-label w-100">
              Final description
              <textarea className="form-control" rows={6} value={finalHtml} onChange={(event) => setFinalHtml(event.target.value)} />
            </label>
            <button className="btn btn-primary" disabled={!adminToken} onClick={() => void saveDecision()}>
              Save final decision
            </button>
            {status && <div className="alert alert-info py-2 mt-3">{status}</div>}
          </div>
        )}
      </section>
    </div>
  );
}

function VoteSummary({ item }: { item: AdminAggregate }) {
  return (
    <div className="row g-2">
      {Object.entries(item.votes).map(([choice, count]) => (
        <div className="col-6 col-md" key={choice}>
          <div className="border rounded-2 p-2 text-center">
            <div className="small text-secondary">{choice}</div>
            <div className="h5 mb-0">{count}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Description({ title, html, onUse }: { title: string; html: string; onUse: () => void }) {
  return (
    <div className="col-lg-4">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h3 className="h6 mb-0">{title}</h3>
        <button className="btn btn-sm btn-outline-primary" onClick={onUse}>
          Use
        </button>
      </div>
      <SafeHtml html={html} />
    </div>
  );
}
