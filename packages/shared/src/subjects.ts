export function splitSubjects(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(";")
        .map((subject) => subject.trim())
        .filter(Boolean)
    )
  );
}

export function subjectsOverlap(a: readonly string[], b: readonly string[]): boolean {
  const selected = new Set(a);
  return b.some((subject) => selected.has(subject));
}

export function deriveSubjects(records: { associatedSubjects: string[] }[]): string[] {
  return Array.from(new Set(records.flatMap((record) => record.associatedSubjects))).sort((a, b) =>
    a.localeCompare(b)
  );
}
