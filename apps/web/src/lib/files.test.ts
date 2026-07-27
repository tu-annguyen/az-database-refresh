import { describe, expect, it } from "vitest";
import { SPRINGSHARE_HEADERS } from "@az-refresh/shared";
import ExcelJS from "exceljs";
import type { AdminAggregate } from "../types";
import { buildSpringshareWorkbook, parseImportFile } from "./files";

describe("workbook import", () => {
  it("parses review descriptions from title-cased workbook headers", async () => {
    const file = await buildWorkbookFile([
      "Database_ID",
      "Database_Name",
      "Associated_Subjects",
      "Original_Description_HTML",
      "Rewritten_Description_A_HTML",
      "Rewritten_Description_B_HTML"
    ]);
    const parsed = await parseImportFile(file);

    expect(parsed.errors).toEqual([]);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.payload.records).toHaveLength(1);
    expect(Object.keys(parsed.payload.records[0]?.springshareMetadata ?? {})).toEqual([...SPRINGSHARE_HEADERS]);
    expect(parsed.payload.records[0]?.databaseId).toBe("2361493");
    expect(parsed.payload.records[0]?.rewrittenDescriptionAHtml).toBe("<p>Rewritten A</p>");
    expect(parsed.payload.records[0]?.rewrittenDescriptionBHtml).toBe("<p>Rewritten B</p>");
  });

  it("parses the staff review CSV with title-cased headers", async () => {
    const csv = [
      "Database_ID,Database_Name,Associated_Subjects,Original_Description_HTML,Rewritten_Description_A_HTML,Rewritten_Description_B_HTML,Database_URL",
      '2361493,Academic Search Complete,Accounting and Tax,"&lt;p&gt;Original&lt;/p&gt;","&lt;p&gt;A&lt;/p&gt;","&lt;p&gt;B&lt;/p&gt;",https://example.test'
    ].join("\n");
    const file = new File([csv], "AZ_Databases_Descriptions_Review.csv", { type: "text/csv" });
    const parsed = await parseImportFile(file);

    expect(parsed.errors).toEqual([]);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.payload.records).toHaveLength(1);
    expect(parsed.subjects).toEqual(["Accounting and Tax"]);
    expect(parsed.payload.records[0]?.databaseId).toBe("2361493");
    expect(parsed.payload.records[0]?.associatedSubjects).toContain("Accounting and Tax");
    expect(parsed.payload.records[0]?.originalDescriptionHtml).toBe("<p>Original</p>");
  });

  it("uses Not available for blank original descriptions on importable rows", async () => {
    const csv = [
      "Database_ID,Database_Name,Associated_Subjects,Original_Description_HTML,Rewritten_Description_A_HTML,Rewritten_Description_B_HTML,Database_URL",
      "1,Example,History,,A,B,https://example.test"
    ].join("\n");
    const file = new File([csv], "blank-description.csv", { type: "text/csv" });
    const parsed = await parseImportFile(file);

    expect(parsed.errors).toEqual([]);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.payload.records).toHaveLength(1);
    expect(parsed.payload.records[0]?.originalDescriptionHtml).toBe("Not available");
  });
});

describe("workbook export", () => {
  it.each([true, false])("removes inactive database rows from the draft=%s workbook", async (draft) => {
    const source = await buildExportWorkbookBase64();
    const workbook = await buildSpringshareWorkbook(source, [aggregate("active", "Active Database")], ["inactive"], draft);
    const worksheet = workbook.getWorksheet("Import Template");

    expect(worksheet?.rowCount).toBe(3);
    expect(worksheet?.getRow(3).getCell(1).value).toBe("active");
    expect(worksheet?.getRow(3).getCell(2).value).toBe("Active Database");
    expect(worksheet?.getRow(3).getCell(11).value).toBe("<p>Final description</p>");
  });

  it("writes an edited database name to the exported workbook", async () => {
    const source = await buildExportWorkbookBase64();
    const workbook = await buildSpringshareWorkbook(
      source,
      [aggregate("active", "Renamed Database")],
      ["inactive"],
      true
    );

    expect(workbook.getWorksheet("Import Template")?.getRow(3).getCell(2).value).toBe("Renamed Database");
  });
});

async function buildWorkbookFile(reviewHeaders: string[]): Promise<File> {
  const workbook = new ExcelJS.Workbook();
  const importSheet = workbook.addWorksheet("Import Template");
  importSheet.addRow([...SPRINGSHARE_HEADERS]);
  importSheet.addRow([]);
  importSheet.addRow([
    "2361493",
    "Academic Search Complete",
    "Yes",
    "",
    "https://example.test",
    "No",
    "",
    "",
    "",
    "",
    "<p>Original</p>",
    "",
    "",
    "Accounting and Tax"
  ]);

  const reviewSheet = workbook.addWorksheet("Review Descriptions");
  reviewSheet.addRow(reviewHeaders);
  reviewSheet.addRow([
    "2361493",
    "Academic Search Complete",
    "Accounting and Tax",
    "<p>Original</p>",
    "<p>Rewritten A</p>",
    "<p>Rewritten B</p>"
  ]);

  const bytes = await workbook.xlsx.writeBuffer();
  return new File([bytes], "reviews.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

async function buildExportWorkbookBase64(): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Import Template");
  worksheet.addRow([...SPRINGSHARE_HEADERS]);
  worksheet.addRow([]);
  worksheet.addRow(["active", "Active Database"]);
  worksheet.addRow(["inactive", "Inactive Database"]);
  const bytes = await workbook.xlsx.writeBuffer();
  return Buffer.from(new Uint8Array(bytes)).toString("base64");
}

function aggregate(databaseId: string, databaseName: string): AdminAggregate {
  return {
    record: {
      databaseId,
      databaseName,
      databaseUrl: "",
      originalDescriptionHtml: "",
      rewrittenDescriptionAHtml: "",
      rewrittenDescriptionBHtml: "",
      associatedSubjects: [],
      springshareMetadata: {}
    },
    votes: {
      original: 0,
      rewritten_a: 0,
      rewritten_b: 0,
      edited: 0,
      needs_follow_up: 0
    },
    reviews: [],
    finalDecision: {
      databaseId,
      decision: "custom_final",
      selectedReviewId: null,
      finalDescriptionHtml: "<p>Final description</p>",
      finalized: true,
      finalizedAt: "2026-07-27T00:00:00.000Z",
      updatedAt: "2026-07-27T00:00:00.000Z"
    },
    completionStatus: "reviewed"
  };
}
