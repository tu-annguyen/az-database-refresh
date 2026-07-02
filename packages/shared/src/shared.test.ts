import { describe, expect, it } from "vitest";
import { SPRINGSHARE_HEADERS } from "./constants";
import { resolveFinalDescription } from "./finalDescription";
import { stripDangerousHtml } from "./sanitize";
import { splitSubjects } from "./subjects";
import { validateSpringshareHeaders } from "./validation";

describe("shared helpers", () => {
  it("splits semicolon-delimited subjects and removes duplicates", () => {
    expect(splitSubjects("History; Business ;History;;")).toEqual(["History", "Business"]);
  });

  it("preserves safe HTML while removing dangerous handlers", () => {
    const html = '<img alt="Covered" onerror="alert(1)" src="https://example.test/a.png"><script>x()</script>';
    expect(stripDangerousHtml(html)).toBe('<img alt="Covered" src="https://example.test/a.png">');
  });

  it("validates the Springshare header order", () => {
    expect(validateSpringshareHeaders([...SPRINGSHARE_HEADERS])).toEqual([]);
    expect(validateSpringshareHeaders(["ID", ...SPRINGSHARE_HEADERS.slice(1)])).toHaveLength(1);
  });

  it("selects final description text from a decision", () => {
    const record = {
      databaseId: "1",
      databaseName: "Example",
      databaseUrl: "",
      originalDescriptionHtml: "O",
      rewrittenDescriptionAHtml: "A",
      rewrittenDescriptionBHtml: "B",
      associatedSubjects: [],
      springshareMetadata: {}
    };
    expect(resolveFinalDescription("use_rewritten_b", record, "", null)).toBe("B");
  });
});
