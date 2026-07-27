import { describe, expect, it } from "vitest";
import { SPRINGSHARE_HEADERS } from "./constants";
import { resolveFinalDescription } from "./finalDescription";
import { hasOneSearchIcon, ONESEARCH_ICON_HTML, setOneSearchIcon } from "./oneSearchIcon";
import { SessionStartSchema } from "./schemas";
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

  it("detects and toggles the Covered in OneSearch icon", () => {
    const description = `${ONESEARCH_ICON_HTML}\n<p>Description</p>`;

    expect(hasOneSearchIcon(description)).toBe(true);
    expect(setOneSearchIcon(description, false)).toBe("<p>Description</p>");
    expect(setOneSearchIcon("<p>Description</p>", true)).toBe(description);
    expect(setOneSearchIcon(description, true)).toBe(description);
  });

  it("recognizes the OneSearch image by source when attributes differ", () => {
    const description =
      '<p>Description</p><img title="Covered" src=\'https://libapps.s3.amazonaws.com/accounts/7085/images/SmallOneSearchO.png\' alt="Covered">';

    expect(hasOneSearchIcon(description)).toBe(true);
    expect(setOneSearchIcon(description, false)).toBe("<p>Description</p>");
  });

  it("starts a reviewer session from subjects, individual databases, or both", () => {
    expect(SessionStartSchema.parse({ selectedSubjects: ["History"] }).selectedDatabaseIds).toEqual([]);
    expect(SessionStartSchema.parse({ selectedSubjects: [], selectedDatabaseIds: ["db-1"] })).toMatchObject({
      selectedDatabaseIds: ["db-1"]
    });
    expect(() => SessionStartSchema.parse({ selectedSubjects: [], selectedDatabaseIds: [] })).toThrow(
      "Select at least one subject or database."
    );
  });
});
