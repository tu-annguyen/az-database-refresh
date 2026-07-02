import { describe, expect, it } from "vitest";
import { SPRINGSHARE_HEADERS } from "@az-refresh/shared";
import ExcelJS from "exceljs";
import { parseImportFile } from "./files";

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
