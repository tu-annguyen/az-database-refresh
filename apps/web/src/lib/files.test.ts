import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SPRINGSHARE_HEADERS } from "@az-refresh/shared";
import { parseImportFile } from "./files";

describe("workbook import", () => {
  it("parses the Springshare template fixture without changing header expectations", async () => {
    const bytes = await readFile(resolve(process.cwd(), "lg2_database_import_template_115.xlsx"));
    const file = new File([bytes], "lg2_database_import_template_115.xlsx");
    const parsed = await parseImportFile(file);

    expect(parsed.errors).toEqual([]);
    expect(parsed.payload.records).toHaveLength(406);
    expect(parsed.subjects).toHaveLength(70);
    expect(parsed.warnings.filter((warning) => warning.includes("skipped because it has no associated subjects"))).toHaveLength(11);
    expect(Object.keys(parsed.payload.records[0]?.springshareMetadata ?? {})).toEqual([...SPRINGSHARE_HEADERS]);
  });

  it("parses the staff review CSV with title-cased headers", async () => {
    const bytes = await readFile(resolve(process.cwd(), "AZ_Databases_Descriptions_Review.csv"));
    const file = new File([bytes], "AZ_Databases_Descriptions_Review.csv", { type: "text/csv" });
    const parsed = await parseImportFile(file);

    expect(parsed.errors).toEqual([]);
    expect(parsed.payload.records).toHaveLength(406);
    expect(parsed.subjects).toHaveLength(70);
    expect(parsed.warnings.filter((warning) => warning.includes("original description is blank"))).toHaveLength(0);
    expect(parsed.warnings.filter((warning) => warning.includes("skipped because it has no associated subjects"))).toHaveLength(11);
    expect(parsed.payload.records[0]?.databaseId).toBe("2361493");
    expect(parsed.payload.records[0]?.associatedSubjects).toContain("Accounting and Tax");
    expect(parsed.payload.records[0]?.originalDescriptionHtml).toContain('<img alt="Covered in OneSearch"');
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
