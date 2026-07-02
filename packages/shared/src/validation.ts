import { CANONICAL_SUBJECTS, SPRINGSHARE_HEADERS } from "./constants";
import type { DatabaseRecord, ImportValidationResult } from "./schemas";
import { deriveSubjects } from "./subjects";

export function validateImportRecords(records: DatabaseRecord[]): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenIds = new Set<string>();
  const canonical = new Set<string>(CANONICAL_SUBJECTS);

  for (const [index, record] of records.entries()) {
    const rowLabel = record.databaseName || `Row ${index + 1}`;
    if (seenIds.has(record.databaseId)) errors.push(`${rowLabel}: duplicate database_id ${record.databaseId}`);
    seenIds.add(record.databaseId);
    if (!record.originalDescriptionHtml.trim()) warnings.push(`${rowLabel}: original description is blank`);
    if (!record.rewrittenDescriptionAHtml.trim()) warnings.push(`${rowLabel}: rewritten description A is blank`);
    if (!record.rewrittenDescriptionBHtml.trim()) warnings.push(`${rowLabel}: rewritten description B is blank`);
    if (record.databaseUrl && !isProbablyUrl(record.databaseUrl)) warnings.push(`${rowLabel}: database URL looks invalid`);
    if (!record.associatedSubjects.length) warnings.push(`${rowLabel}: no associated subjects`);
    for (const subject of record.associatedSubjects) {
      if (!canonical.has(subject)) warnings.push(`${rowLabel}: unknown subject "${subject}"`);
    }
  }

  return { errors, warnings, records, subjects: deriveSubjects(records) };
}

export function validateSpringshareHeaders(headers: string[]): string[] {
  const errors: string[] = [];
  SPRINGSHARE_HEADERS.forEach((expected, index) => {
    if (headers[index] !== expected) {
      errors.push(`Column ${index + 1}: expected "${expected}", found "${headers[index] ?? ""}"`);
    }
  });
  return errors;
}

function isProbablyUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
