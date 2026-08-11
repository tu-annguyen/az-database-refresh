import { useMemo, useState } from "react";
import { AdminDashboard } from "./components/AdminDashboard";
import { ReviewerApp } from "./components/ReviewerApp";
import { ResultAdminApp } from "./components/ResultAdminApp";

type View = "reviewer" | "admin" | "result-admin";

export function App() {
  const initialReviewerToken = useMemo(() => {
    const match = window.location.pathname.match(/^\/review\/(.+)$/);
    return match?.[1] ? decodeURIComponent(match[1]) : "";
  }, []);
  const initialResultAdminToken = useMemo(() => {
    const match = window.location.pathname.match(/^\/admin-review\/(.+)$/);
    return match?.[1] ? decodeURIComponent(match[1]) : "";
  }, []);
  const [view, setView] = useState<View>(initialResultAdminToken ? "result-admin" : initialReviewerToken ? "reviewer" : "admin");

  return (
    <div className="app-shell">
      <header className="brand-bar">
        <div className="workspace mx-auto px-3 py-3 d-flex flex-wrap gap-3 align-items-center justify-content-between">
          <div>
            <h1 className="h4 mb-0">Library Database Review</h1>
            <div className="text-secondary small">Faculty feedback and Springshare description export</div>
          </div>
          {view !== "result-admin" && <div className="btn-group" role="group" aria-label="Application view">
            <button className={`btn btn-sm ${view === "admin" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setView("admin")}>
              Admin
            </button>
            <button className={`btn btn-sm ${view === "reviewer" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setView("reviewer")}>
              Reviewer
            </button>
          </div>}
        </div>
      </header>
      <main className="workspace mx-auto px-3 py-4">
        {view === "result-admin"
          ? <ResultAdminApp initialToken={initialResultAdminToken} />
          : view === "admin" ? <AdminDashboard /> : <ReviewerApp initialToken={initialReviewerToken} />}
      </main>
    </div>
  );
}
