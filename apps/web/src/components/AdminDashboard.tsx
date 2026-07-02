import { useState } from "react";
import { AggregationPanel } from "./AggregationPanel";
import { AdminImportPanel } from "./AdminImportPanel";
import { ReviewerManager } from "./ReviewerManager";
import { TokenInput } from "./TokenInput";

type Tab = "import" | "reviewers" | "results";

export function AdminDashboard() {
  const [adminToken, setAdminToken] = useState("");
  const [tab, setTab] = useState<Tab>("import");

  return (
    <div className="row g-4">
      <aside className="col-lg-3">
        <div className="bg-white border rounded-2 p-3">
          <TokenInput label="Admin token" value={adminToken} onChange={setAdminToken} />
          <div className="list-group mt-3">
            {[
              ["import", "Import"],
              ["reviewers", "Reviewers"],
              ["results", "Results"]
            ].map(([id, label]) => (
              <button
                key={id}
                className={`list-group-item list-group-item-action ${tab === id ? "active" : ""}`}
                onClick={() => setTab(id as Tab)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </aside>
      <section className="col-lg-9">
        {tab === "import" && <AdminImportPanel adminToken={adminToken} />}
        {tab === "reviewers" && <ReviewerManager adminToken={adminToken} />}
        {tab === "results" && <AggregationPanel adminToken={adminToken} />}
      </section>
    </div>
  );
}
