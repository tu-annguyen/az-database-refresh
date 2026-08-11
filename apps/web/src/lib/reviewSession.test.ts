import { describe, expect, it } from "vitest";
import { getReviewSessionCounts, isReviewFormDirty } from "./reviewSession";

describe("review session status", () => {
  it("counts saved and no-input databases within the session", () => {
    expect(getReviewSessionCounts(["one", "two", "three"], new Set())).toEqual({ saved: 0, noInput: 3 });
    expect(getReviewSessionCounts(["one", "two", "three"], new Set(["one", "three"]))).toEqual({
      saved: 2,
      noInput: 1
    });
    expect(getReviewSessionCounts(["one", "two", "three"], new Set(["one", "two", "three"]))).toEqual({
      saved: 3,
      noInput: 0
    });
  });

  it("does not count saved databases outside the current session", () => {
    expect(getReviewSessionCounts(["one"], new Set(["one", "other"]))).toEqual({ saved: 1, noInput: 0 });
  });
});

describe("review form dirty state", () => {
  const blankForm = { choice: null, revision: "", comments: "" } as const;

  it("treats an untouched form as clean", () => {
    expect(isReviewFormDirty(blankForm)).toBe(false);
  });

  it("detects every kind of unsaved input", () => {
    expect(isReviewFormDirty({ ...blankForm, choice: "original" })).toBe(true);
    expect(isReviewFormDirty({ ...blankForm, revision: "Draft" })).toBe(true);
    expect(isReviewFormDirty({ ...blankForm, comments: "Concern" })).toBe(true);
  });

  it("compares edits with the last saved review", () => {
    const saved = { choice: "edited" as const, revisedDescriptionHtml: "Saved text", comments: "Saved note" };
    expect(isReviewFormDirty({ choice: "edited", revision: "Saved text", comments: "Saved note" }, saved)).toBe(false);
    expect(isReviewFormDirty({ choice: "edited", revision: "Changed", comments: "Saved note" }, saved)).toBe(true);
  });
});
