type Props = {
  current: number;
  total: number;
  label: string;
  ariaLabel: string;
  updatedAt?: string | null;
};

export function ProgressSummary({ current, total, label, ariaLabel, updatedAt }: Props) {
  const percentage = total > 0 ? Math.min(100, (current / total) * 100) : 0;

  return (
    <div style={{ minWidth: "9rem" }}>
      <div className="small">{label}</div>
      <div
        className="progress mt-1"
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
        style={{ height: "6px" }}
      >
        <div className="progress-bar" style={{ width: `${percentage}%` }} />
      </div>
      {updatedAt && (
        <div className="small text-secondary mt-1" title={formatDate(updatedAt)}>
          Updated {formatRelativeDate(updatedAt)}
        </div>
      )}
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatRelativeDate(value: string): string {
  const elapsedSeconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const intervals: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60]
  ];
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const interval = intervals.find(([, seconds]) => Math.abs(elapsedSeconds) >= seconds);
  return interval
    ? formatter.format(Math.round(elapsedSeconds / interval[1]), interval[0])
    : formatter.format(elapsedSeconds, "second");
}
