import { CHOICE_LABELS, type DatabaseRecord, type ReviewChoice } from "@az-refresh/shared";
import { useEffect, useMemo, useState } from "react";
import { reviewerMe, reviewerSaveReview, reviewerStartSession } from "../api";
import { SafeHtml } from "./SafeHtml";
import { TokenInput } from "./TokenInput";

type Props = {
  initialToken: string;
};

export function ReviewerApp({ initialToken }: Props) {
  const [token, setToken] = useState(initialToken);
  const [name, setName] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [records, setRecords] = useState<DatabaseRecord[]>([]);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<ReviewChoice>("rewritten_a");
  const [revision, setRevision] = useState("");
  const [comments, setComments] = useState("");
  const [status, setStatus] = useState("");

  const current = records[index];
  const progress = useMemo(() => (records.length ? `${index + 1} of ${records.length}` : "0 of 0"), [index, records.length]);

  async function loadIdentity() {
    setStatus("Loading reviewer...");
    const result = await reviewerMe(token);
    setName(result.reviewer.name);
    setSubjects(result.subjects);
    setStatus("");
  }

  async function startSession() {
    setStatus("Building review queue...");
    const result = await reviewerStartSession(token, selectedSubjects);
    setSessionId(result.sessionId);
    setRecords(result.records);
    setIndex(0);
    resetForm();
    setStatus(`Loaded ${result.records.length} databases.`);
  }

  async function saveAndMove(nextIndex: number) {
    if (!current || !sessionId) return;
    if (choice === "edited" && !revision.trim()) {
      setStatus("A revised description is required when choosing Edited / revised version.");
      return;
    }
    setStatus("Saving review...");
    await reviewerSaveReview(token, {
      sessionId,
      databaseId: current.databaseId,
      selectedSubjects,
      choice,
      revisedDescriptionHtml: revision,
      comments
    });
    setIndex(Math.max(0, Math.min(nextIndex, records.length - 1)));
    resetForm();
    setStatus("Saved.");
  }

  useEffect(() => {
    if (token) void loadIdentity();
  }, [token]);

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
          <SubjectSelector
            subjects={subjects}
            selected={selectedSubjects}
            onChange={setSelectedSubjects}
            onStart={() => void startSession()}
            disabled={!token || selectedSubjects.length === 0}
          />
        ) : (
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
                <div className="progress-bar" style={{ width: `${records.length ? ((index + 1) / records.length) * 100 : 0}%` }} />
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
                            onChange={() => setChoice(value)}
                          />
                          {label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <label className="form-label w-100 mt-3">
                  Revised description
                  <textarea className="form-control" rows={4} value={revision} onChange={(event) => setRevision(event.target.value)} />
                </label>
                <label className="form-label w-100">
                  Comments / concerns
                  <textarea className="form-control" rows={3} value={comments} onChange={(event) => setComments(event.target.value)} />
                </label>
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-secondary" disabled={index === 0} onClick={() => void saveAndMove(index - 1)}>
                    Save & Previous
                  </button>
                  <button className="btn btn-primary" onClick={() => void saveAndMove(index + 1)}>
                    Save & Next
                  </button>
                </div>
              </>
            )}
            {status && <div className="alert alert-info py-2 mt-3">{status}</div>}
          </div>
        )}
      </section>
    </div>
  );

  function resetForm() {
    setChoice("rewritten_a");
    setRevision("");
    setComments("");
  }
}

function SubjectSelector({
  subjects,
  selected,
  disabled,
  onChange,
  onStart
}: {
  subjects: string[];
  selected: string[];
  disabled: boolean;
  onChange: (subjects: string[]) => void;
  onStart: () => void;
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
      <button className="btn btn-primary" disabled={disabled} onClick={onStart}>
        Start review
      </button>
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
