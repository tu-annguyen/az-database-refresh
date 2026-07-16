import type { DatabaseRecord } from "@az-refresh/shared";
import { useMemo } from "react";
import type { ReviewSummary } from "../types";
import { getReviewSessionCounts } from "../lib/reviewSession";

type Props = {
  records: DatabaseRecord[];
  currentIndex: number;
  savedReviews: Record<string, ReviewSummary>;
  onNavigate: (index: number) => void;
};

export function ReviewSessionNavigator({ records, currentIndex, savedReviews, onNavigate }: Props) {
  const savedDatabaseIds = useMemo(() => new Set(Object.keys(savedReviews)), [savedReviews]);
  const counts = getReviewSessionCounts(
    records.map((record) => record.databaseId),
    savedDatabaseIds
  );

  return (
    <nav className="review-session-navigator" aria-label="Databases in this review session">
      <div className="d-flex flex-wrap gap-3 align-items-center mb-2 small">
        <span className="text-success fw-semibold">{counts.saved} saved</span>
        <span className="text-secondary">{counts.noInput} no input</span>
      </div>
      <div className="review-index-list">
        {records.map((record, recordIndex) => {
          const saved = savedDatabaseIds.has(record.databaseId);
          const current = recordIndex === currentIndex;
          const status = saved ? "saved" : "no input";
          return (
            <button
              key={record.databaseId}
              type="button"
              className={`review-index-button ${saved ? "is-saved" : "is-unsaved"} ${current ? "is-current" : ""}`}
              aria-current={current ? "step" : undefined}
              aria-label={`Database ${recordIndex + 1}, ${record.databaseName}: ${status}`}
              title={`${record.databaseName}: ${status}`}
              onClick={() => onNavigate(recordIndex)}
            >
              <span aria-hidden="true" className="review-index-check">
                ✓
              </span>
              <span>{recordIndex + 1}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
