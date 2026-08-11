import { describe, expect, it } from "vitest";
import { updateDatabaseSelection } from "./databaseSelection";

const visibleIds = ["alpha", "beta", "gamma", "delta"];

describe("updateDatabaseSelection", () => {
  it("toggles one database without a valid shift anchor", () => {
    expect([...updateDatabaseSelection(new Set(["hidden"]), visibleIds, null, "beta", true, false)])
      .toEqual(["hidden", "beta"]);
    expect([...updateDatabaseSelection(new Set(["beta"]), visibleIds, "hidden", "beta", false, true)])
      .toEqual([]);
  });

  it("shift-selects the inclusive range while preserving other selections", () => {
    expect([...updateDatabaseSelection(new Set(["hidden"]), visibleIds, "beta", "delta", true, true)])
      .toEqual(["hidden", "beta", "gamma", "delta"]);
  });

  it("shift-deselects the inclusive range in either direction", () => {
    const selected = new Set(["alpha", "beta", "gamma", "delta", "hidden"]);
    expect([...updateDatabaseSelection(selected, visibleIds, "delta", "beta", false, true)])
      .toEqual(["alpha", "hidden"]);
  });
});
