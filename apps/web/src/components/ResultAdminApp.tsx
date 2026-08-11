import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { resultAdminMe } from "../api";
import { AggregationPanel } from "./AggregationPanel";

export function ResultAdminApp({ initialToken }: { initialToken: string }) {
  const [adminName, setAdminName] = useState("");
  const [sidebar, setSidebar] = useState<ReactNode>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!initialToken) return;
    setStatus("Loading admin review link...");
    void resultAdminMe(initialToken)
      .then(({ admin }) => { setAdminName(admin.name); setStatus(""); })
      .catch((error) => { setAdminName(""); setStatus(error instanceof Error ? error.message : "Unable to load admin."); });
  }, [initialToken]);

  return <div className="row g-4">
    <aside className="col-lg-3">
      <div className="bg-white border rounded-2 p-3">
        <div className="small fw-semibold text-secondary">Admin results</div>
        {adminName && <div className="alert alert-success py-2 mt-2 mb-0">Signed in as {adminName}</div>}
        {status && <div className="alert alert-info py-2 mt-2 mb-0">{status}</div>}
        {adminName && sidebar}
      </div>
    </aside>
    <section className="col-lg-9">
      {adminName && <AggregationPanel resultAdminToken={initialToken} showResultsControls={false} onSidebarChange={setSidebar} />}
    </section>
  </div>;
}
