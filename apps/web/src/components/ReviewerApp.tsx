import { CHOICE_LABELS, type DatabaseRecord, type ReviewChoice } from "@az-refresh/shared";
import { useEffect, useMemo, useState } from "react";
import { reviewerMe, reviewerResumeSession, reviewerSaveReview, reviewerStartSession } from "../api";
import type { DatabaseOption, ReviewerSessionSummary, ReviewSummary } from "../types";
import { DatabaseCombobox } from "./DatabaseCombobox";
import { SafeHtml } from "./SafeHtml";
import { TokenInput } from "./TokenInput";

type Props = {
  initialToken: string;
};

export function ReviewerApp({ initialToken }: Props) {
  const [token, setToken] = useState(initialToken);
  const [name, setName] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [databases, setDatabases] = useState<DatabaseOption[]>([]);
  const [currentSession, setCurrentSession] = useState<ReviewerSessionSummary | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedDatabaseIds, setSelectedDatabaseIds] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [records, setRecords] = useState<DatabaseRecord[]>([]);
  const [savedReviews, setSavedReviews] = useState<Record<string, ReviewSummary>>({});
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<ReviewChoice | null>(null);
  const [revision, setRevision] = useState("");
  const [comments, setComments] = useState("");
  const [status, setStatus] = useState("");

  const current = records[index];
  const progress = useMemo(() => (records.length ? `${index + 1} of ${records.length}` : "0 of 0"), [index, records.length]);

  async function loadIdentity() {
    try {
      setStatus("Loading reviewer...");
      const result = await reviewerMe(token);
      setName(result.reviewer.name);
      setSubjects(result.subjects);
      setDatabases(result.databases);
      setCurrentSession(result.currentSession);
      setSelectedSubjects(result.currentSession?.selectedSubjects ?? []);
      setSelectedDatabaseIds(result.currentSession?.selectedDatabaseIds ?? []);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load reviewer.");
    }
  }

  async function resumeSession() {
    try {
      setStatus("Loading saved session...");
      const result = await reviewerResumeSession(token);
      enterSession(
        result.sessionId,
        result.selectedSubjects,
        result.selectedDatabaseIds,
        result.records,
        result.reviews
      );
      setStatus(`Resumed ${result.records.length} databases.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to resume session.");
    }
  }

  async function startSession() {
    try {
      setStatus("Building review queue...");
      const result = await reviewerStartSession(token, selectedSubjects, selectedDatabaseIds);
      const now = new Date().toISOString();
      enterSession(result.sessionId, selectedSubjects, selectedDatabaseIds, result.records, result.reviews);
      setCurrentSession({
        id: result.sessionId,
        selectedSubjects,
        selectedDatabaseIds,
        startedAt: now,
        updatedAt: now,
        reviewCount: 0
      });
      setStatus(`Loaded ${result.records.length} databases.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to start session.");
    }
  }

  async function saveAndMove(nextIndex: number) {
    if (!current || !sessionId) return;
    if (!choice) {
      setStatus("Select which description should be used before saving.");
      return;
    }
    if (choice === "edited" && !revision.trim()) {
      setStatus("A revised description is required when choosing Edited / revised version.");
      return;
    }
    setStatus("Saving review...");
    const saved = await reviewerSaveReview(token, {
      sessionId,
      databaseId: current.databaseId,
      selectedSubjects,
      choice,
      revisedDescriptionHtml: revision,
      comments
    });
    const now = new Date().toISOString();
    const wasAlreadySaved = Boolean(savedReviews[current.databaseId]);
    setSavedReviews((existing) => ({
      ...existing,
      [current.databaseId]: {
        id: saved.reviewId,
        reviewerId: existing[current.databaseId]?.reviewerId ?? "",
        reviewerName: existing[current.databaseId]?.reviewerName ?? "",
        reviewerEmail: existing[current.databaseId]?.reviewerEmail ?? "",
        sessionId,
        databaseId: current.databaseId,
        selectedSubjects,
        choice,
        revisedDescriptionHtml: revision,
        comments,
        updatedAt: now,
        createdAt: existing[current.databaseId]?.createdAt ?? now
      }
    }));
    setCurrentSession((existing) =>
      existing
        ? {
            ...existing,
            updatedAt: now,
            reviewCount: existing.reviewCount + (wasAlreadySaved ? 0 : 1)
          }
        : existing
    );
    setIndex(Math.max(0, Math.min(nextIndex, records.length - 1)));
    setStatus("Saved.");
  }

  function enterSession(
    nextSessionId: string,
    nextSelectedSubjects: string[],
    nextSelectedDatabaseIds: string[],
    nextRecords: DatabaseRecord[],
    reviews: ReviewSummary[]
  ) {
    const reviewMap = Object.fromEntries(reviews.map((review) => [review.databaseId, review]));
    const firstUnreviewed = nextRecords.findIndex((record) => !reviewMap[record.databaseId]);
    setSessionId(nextSessionId);
    setSelectedSubjects(nextSelectedSubjects);
    setSelectedDatabaseIds(nextSelectedDatabaseIds);
    setRecords(nextRecords);
    setSavedReviews(reviewMap);
    setIndex(firstUnreviewed >= 0 ? firstUnreviewed : 0);
  }

  useEffect(() => {
    if (token) void loadIdentity();
  }, [token]);

  useEffect(() => {
    if (!current) return;
    const saved = savedReviews[current.databaseId];
    if (!saved) {
      resetForm();
      return;
    }
    setChoice(saved.choice);
    setRevision(saved.revisedDescriptionHtml);
    setComments(saved.comments);
  }, [current?.databaseId, savedReviews]);

  return (
    <div className="row g-4">
      <aside className="col-lg-3">
        <div className="bg-white border rounded-2 p-3">
          <TokenInput label="Reviewer token" value={token} onChange={setToken} />
          {name && <div className="alert alert-success py-2 mt-3 mb-0">Signed in as {name}</div>}
        </div>
      </aside>
      <section className="col-lg-9">
        {!sessionId ? (
          <ReviewerHome
            currentSession={currentSession}
            subjects={subjects}
            databases={databases}
            selected={selectedSubjects}
            selectedDatabaseIds={selectedDatabaseIds}
            onChange={setSelectedSubjects}
            onDatabaseChange={setSelectedDatabaseIds}
            onResume={() => void resumeSession()}
            onStart={() => void startSession()}
            disabled={!token || (selectedSubjects.length === 0 && selectedDatabaseIds.length === 0)}
          />
        ) : (
          <ReviewQueue
            current={current}
            progress={progress}
            recordsCount={records.length}
            index={index}
            choice={choice}
            revision={revision}
            comments={comments}
            status={status}
            onChoice={setChoice}
            onRevision={setRevision}
            onComments={setComments}
            onSavePrevious={() => void saveAndMove(index - 1)}
            onSaveNext={() => void saveAndMove(index + 1)}
          />
        )}
      </section>
    </div>
  );

  function resetForm() {
    setChoice(null);
    setRevision("");
    setComments("");
  }
}

function ReviewerHome({
  currentSession,
  subjects,
  databases,
  selected,
  selectedDatabaseIds,
  disabled,
  onChange,
  onDatabaseChange,
  onResume,
  onStart
}: {
  currentSession: ReviewerSessionSummary | null;
  subjects: string[];
  databases: DatabaseOption[];
  selected: string[];
  selectedDatabaseIds: string[];
  disabled: boolean;
  onChange: (subjects: string[]) => void;
  onDatabaseChange: (databaseIds: string[]) => void;
  onResume: () => void;
  onStart: () => void;
}) {
  return (
    <div className="d-grid gap-3">
      {currentSession && (
        <div className="bg-white border rounded-2 p-4">
          <div className="d-flex flex-wrap gap-3 justify-content-between align-items-start">
            <div>
              <h2 className="h5 mb-1">Previous session</h2>
              <div className="text-secondary small">Last modified {formatDate(currentSession.updatedAt)}</div>
              <div className="mt-2">{currentSession.selectedSubjects.join("; ")}</div>
              {currentSession.selectedDatabaseIds.length > 0 && (
                <div className="small text-secondary mt-1">
                  {currentSession.selectedDatabaseIds.length} individually selected database
                  {currentSession.selectedDatabaseIds.length === 1 ? "" : "s"}
                </div>
              )}
              <div className="small text-secondary mt-1">{currentSession.reviewCount} saved reviews</div>
            </div>
            <button className="btn btn-primary" onClick={onResume}>
              Continue session
            </button>
          </div>
        </div>
      )}
      <SubjectSelector
        subjects={subjects}
        databases={databases}
        selected={selected}
        selectedDatabaseIds={selectedDatabaseIds}
        onChange={onChange}
        onDatabaseChange={onDatabaseChange}
        onStart={onStart}
        disabled={disabled}
        buttonLabel={currentSession ? "Start new session" : "Start review"}
      />
    </div>
  );
}

function SubjectSelector({
  subjects,
  databases,
  selected,
  selectedDatabaseIds,
  disabled,
  onChange,
  onDatabaseChange,
  onStart,
  buttonLabel
}: {
  subjects: string[];
  databases: DatabaseOption[];
  selected: string[];
  selectedDatabaseIds: string[];
  disabled: boolean;
  onChange: (subjects: string[]) => void;
  onDatabaseChange: (databaseIds: string[]) => void;
  onStart: () => void;
  buttonLabel: string;
}) {
  return (
    <div className="bg-white border rounded-2 p-4">
      <h2 className="h5">Select subjects</h2>
      <div className="subject-grid my-3">
        {subjects.map((subject) => (
          <label className="form-check mb-2" key={subject}>
            <input
              className="form-check-input"
              type="checkbox"
              checked={selected.includes(subject)}
              onChange={(event) =>
                onChange(event.target.checked ? [...selected, subject] : selected.filter((item) => item !== subject))
              }
            />
            <span className="form-check-label">{subject}</span>
          </label>
        ))}
      </div>
      <div className="border-top pt-3 mb-3">
        <DatabaseCombobox databases={databases} selectedIds={selectedDatabaseIds} onChange={onDatabaseChange} />
      </div>
      <button className="btn btn-primary" disabled={disabled} onClick={onStart}>
        {buttonLabel}
      </button>
    </div>
  );
}

function ReviewQueue({
  current,
  progress,
  recordsCount,
  index,
  choice,
  revision,
  comments,
  status,
  onChoice,
  onRevision,
  onComments,
  onSavePrevious,
  onSaveNext
}: {
  current: DatabaseRecord | undefined;
  progress: string;
  recordsCount: number;
  index: number;
  choice: ReviewChoice | null;
  revision: string;
  comments: string;
  status: string;
  onChoice: (choice: ReviewChoice) => void;
  onRevision: (value: string) => void;
  onComments: (value: string) => void;
  onSavePrevious: () => void;
  onSaveNext: () => void;
}) {
  return (
    <div className="bg-white border rounded-2 p-4 queue-panel">
      <div className="d-flex flex-wrap gap-3 justify-content-between mb-3">
        <div>
          <h2 className="h5 mb-1">{current?.databaseName ?? "No matching databases"}</h2>
          {current && (
            <div className="text-secondary small">
              ID {current.databaseId} · {progress}
            </div>
          )}
        </div>
        <div className="progress flex-grow-1 align-self-center" style={{ maxWidth: "280px", height: "10px" }}>
          <div className="progress-bar" style={{ width: `${recordsCount ? ((index + 1) / recordsCount) * 100 : 0}%` }} />
        </div>
      </div>

      {current && (
        <>
          <div className="mb-3">
            <a href={current.databaseUrl} target="_blank" rel="noreferrer">
              {current.databaseUrl}
            </a>
            <div className="small text-secondary mt-1">{current.associatedSubjects.join("; ")}</div>
          </div>
          <div className="row g-3">
            <DescriptionColumn title="Original Description" html={current.originalDescriptionHtml} />
            <DescriptionColumn title="Rewritten Description A" html={current.rewrittenDescriptionAHtml} />
            <DescriptionColumn title="Rewritten Description B" html={current.rewrittenDescriptionBHtml} />
          </div>
          <div className="mt-4">
            <label className="form-label">Which description should be used?</label>
            <div className="row g-2">
              {(Object.entries(CHOICE_LABELS) as [ReviewChoice, string][]).map(([value, label]) => (
                <div className="col-md-6" key={value}>
                  <label className="border rounded-2 p-2 w-100">
                    <input
                      className="form-check-input me-2"
                      type="radio"
                      checked={choice === value}
                      onChange={() => onChoice(value)}
                    />
                    {label}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <label className="form-label w-100 mt-3">
            Revised description
            <textarea className="form-control" rows={4} value={revision} onChange={(event) => onRevision(event.target.value)} />
          </label>
          <label className="form-label w-100">
            Comments / concerns
            <textarea className="form-control" rows={3} value={comments} onChange={(event) => onComments(event.target.value)} />
          </label>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary" disabled={index === 0} onClick={onSavePrevious}>
              Save & Previous
            </button>
            <button className="btn btn-primary" onClick={onSaveNext}>
              Save & Next
            </button>
          </div>
        </>
      )}
      {status && <div className="alert alert-info py-2 mt-3">{status}</div>}
    </div>
  );
}

function DescriptionColumn({ title, html }: { title: string; html: string }) {
  return (
    <div className="col-xl-4">
      <h3 className="h6">{title}</h3>
      <SafeHtml html={html} />
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
