import {
  SPRINGSHARE_HEADERS,
  type DatabaseRecord,
  type ImportCommit,
  validateImportRecords,
  validateSpringshareHeaders
} from "@az-refresh/shared";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import type { AdminAggregate } from "../types";

const REVIEW_SHEET = "Review Descriptions";
const IMPORT_SHEET = "Import Template";

type ParsedImport = {
  payload: ImportCommit;
  errors: string[];
  warnings: string[];
  subjects: string[];
};

export async function parseImportFile(file: File): Promise<ParsedImport> {
  const buffer = await file.arrayBuffer();
  if (file.name.toLowerCase().endsWith(".csv")) return parseCsv(file.name, buffer);
  return parseWorkbook(file.name, buffer);
}

export function downloadRawReviewsCsv(aggregates: AdminAggregate[]): void {
  const rows = aggregates.flatMap((item) =>
    item.reviews.map((review) => ({
      database_id: item.record.databaseId,
      database_name: item.record.databaseName,
      reviewer_id: review.reviewerId,
      selected_subjects: review.selectedSubjects.join("; "),
      choice: review.choice,
      revised_description: review.revisedDescriptionHtml,
      comments: review.comments,
      updated_at: review.updatedAt
    }))
  );
  downloadText("raw-faculty-reviews.csv", toCsv(rows));
}

export function downloadAggregateCsv(aggregates: AdminAggregate[]): void {
  const rows = aggregates.map((item) => ({
    database_id: item.record.databaseId,
    database_name: item.record.databaseName,
    votes_original: item.votes.original,
    votes_a: item.votes.rewritten_a,
    votes_b: item.votes.rewritten_b,
    votes_edited: item.votes.edited,
    votes_needs_follow_up: item.votes.needs_follow_up,
    finalized: item.finalDecision?.finalized ? "yes" : "no",
    final_decision: item.finalDecision?.decision ?? "",
    comments: item.reviews.map((review) => review.comments).filter(Boolean).join(" | ")
  }));
  downloadText("aggregated-vote-summary.csv", toCsv(rows));
}

export async function downloadSpringshareWorkbook(base64: string, aggregates: AdminAggregate[], draft: boolean): Promise<void> {
  if (!base64) throw new Error("No source workbook is stored for the active import batch.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(base64ToArrayBuffer(base64));
  const worksheet = workbook.getWorksheet(IMPORT_SHEET);
  if (!worksheet) throw new Error(`Workbook is missing "${IMPORT_SHEET}" sheet.`);
  const finalById = new Map(
    aggregates
      .filter((item) => draft || item.finalDecision?.finalized)
      .map((item) => [item.record.databaseId, item.finalDecision?.finalDescriptionHtml ?? ""])
  );
  for (let row = 3; row <= worksheet.rowCount; row += 1) {
    const id = cellText(worksheet.getRow(row).getCell(1).value);
    const finalDescription = finalById.get(id);
    if (finalDescription !== undefined && finalDescription !== "") {
      worksheet.getRow(row).getCell(11).value = finalDescription;
    }
  }
  const bytes = await workbook.xlsx.writeBuffer();
  downloadBlob(
    draft ? "springshare-description-export-draft.xlsx" : "springshare-description-export-final.xlsx",
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    })
  );
}

function parseCsv(filename: string, buffer: ArrayBuffer): ParsedImport {
  const text = new TextDecoder().decode(buffer);
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const records = parsed.data.map((row) => ({
    databaseId: readCsvField(row, ["database_id", "Database_ID", "ID (Required)", "ID"]),
    databaseName: readCsvField(row, ["database_name", "Database_Name", "DATABASE NAME (Required)"]),
    databaseUrl: readCsvField(row, ["database_url", "Database_URL", "DATABASE URL"]),
    originalDescriptionHtml: decodeHtmlEntities(
      readCsvField(row, ["original_description_html", "Original_Description_HTML", "DATABASE DESCRIPTION"])
    ),
    rewrittenDescriptionAHtml: decodeHtmlEntities(
      readCsvField(row, ["rewritten_description_a_html", "Rewritten_Description_A_HTML"])
    ),
    rewrittenDescriptionBHtml: decodeHtmlEntities(
      readCsvField(row, ["rewritten_description_b_html", "Rewritten_Description_B_HTML"])
    ),
    associatedSubjects: splitSubjects(readCsvField(row, ["associated_subjects", "Associated_Subjects", "ASSOCIATED SUBJECTS"])),
    springshareMetadata: {}
  }));
  return buildParsedImport(filename, "", records, parsed.errors.map((error) => error.message));
}

async function parseWorkbook(filename: string, buffer: ArrayBuffer): Promise<ParsedImport> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const importSheet = workbook.getWorksheet(IMPORT_SHEET);
  if (!importSheet) return buildParsedImport(filename, arrayBufferToBase64(buffer), [], [`Missing "${IMPORT_SHEET}" sheet.`]);

  const headers = rowValues(importSheet.getRow(1));
  const headerErrors = validateSpringshareHeaders(headers);
  const reviewRows = getReviewRows(workbook);

  const records: DatabaseRecord[] = [];
  for (let rowNumber = 3; rowNumber <= importSheet.rowCount; rowNumber += 1) {
    const row = importSheet.getRow(rowNumber);
    const values = rowValues(row);
    const id = values[0] ?? "";
    if (!id && values.every((value) => !value)) continue;
    const review = reviewRows.get(id);
    const metadata = Object.fromEntries(SPRINGSHARE_HEADERS.map((header, index) => [header, values[index] ?? ""]));
    records.push({
      databaseId: id,
      databaseName: values[1] ?? "",
      databaseUrl: values[4] ?? "",
      originalDescriptionHtml: values[10] ?? "",
      rewrittenDescriptionAHtml: review?.a ?? "",
      rewrittenDescriptionBHtml: review?.b ?? "",
      associatedSubjects: splitSubjects(values[13] ?? ""),
      springshareMetadata: metadata
    });
  }

  return buildParsedImport(filename, arrayBufferToBase64(buffer), records, headerErrors);
}

function getReviewRows(workbook: ExcelJS.Workbook): Map<string, { a: string; b: string }> {
  const worksheet = workbook.getWorksheet(REVIEW_SHEET);
  if (!worksheet) return new Map();
  const headers = rowValues(worksheet.getRow(1));
  const idColumn = headers.indexOf("database_id") + 1;
  const aColumn = headers.indexOf("rewritten_description_a_html") + 1;
  const bColumn = headers.indexOf("rewritten_description_b_html") + 1;
  const rows = new Map<string, { a: string; b: string }>();
  if (!idColumn || !aColumn || !bColumn) return rows;
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const id = cellText(row.getCell(idColumn).value);
    if (!id) continue;
    rows.set(id, {
      a: cellText(row.getCell(aColumn).value),
      b: cellText(row.getCell(bColumn).value)
    });
  }
  return rows;
}

function buildParsedImport(
  filename: string,
  sourceWorkbookBase64: string,
  records: DatabaseRecord[],
  parseErrors: string[]
): ParsedImport {
  const { records: importableRecords, warnings: normalizationWarnings } = normalizeImportRecords(records);
  const validation = validateImportRecords(importableRecords);
  return {
    payload: { filename, sourceWorkbookBase64, records: importableRecords },
    errors: [...parseErrors, ...validation.errors],
    warnings: [...normalizationWarnings, ...validation.warnings],
    subjects: validation.subjects
  };
}

function normalizeImportRecords(records: DatabaseRecord[]): { records: DatabaseRecord[]; warnings: string[] } {
  const warnings: string[] = [];
  const importableRecords: DatabaseRecord[] = [];

  for (const record of records) {
    const rowLabel = record.databaseName || `database_id ${record.databaseId || "unknown"}`;
    if (!record.associatedSubjects.length) {
      warnings.push(`${rowLabel}: skipped because it has no associated subjects`);
      continue;
    }

    importableRecords.push({
      ...record,
      originalDescriptionHtml: record.originalDescriptionHtml.trim() || "Not available"
    });
  }

  return { records: importableRecords, warnings };
}

function splitSubjects(raw: string): string[] {
  return raw
    .split(";")
    .map((subject) => subject.trim())
    .filter(Boolean);
}

function readCsvField(row: Record<string, string>, names: string[]): string {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), value ?? ""])
  );
  for (const name of names) {
    const value = normalized.get(normalizeHeader(name));
    if (value !== undefined) return value.trim();
  }
  return "";
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function rowValues(row: ExcelJS.Row): string[] {
  return Array.from({ length: row.cellCount }, (_, index) => cellText(row.getCell(index + 1).value));
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("hyperlink" in value && typeof value.hyperlink === "string") return value.hyperlink;
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text).join("");
    }
    if ("result" in value) return String(value.result ?? "");
  }
  return String(value);
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0] ?? {});
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsv(row[header])).join(","));
  }
  return lines.join("\n");
}

function escapeCsv(value: unknown): string {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadText(filename: string, text: string): void {
  downloadBlob(filename, new Blob([text], { type: "text/csv;charset=utf-8" }));
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
