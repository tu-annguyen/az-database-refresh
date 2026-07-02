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
    expect(parsed.payload.records).toHaveLength(417);
    expect(parsed.subjects).toHaveLength(70);
    expect(Object.keys(parsed.payload.records[0]?.springshareMetadata ?? {})).toEqual([...SPRINGSHARE_HEADERS]);
  });
});
