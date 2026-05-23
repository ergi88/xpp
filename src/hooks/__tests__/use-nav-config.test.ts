import { describe, it, expect } from "vitest";
import { parseNavConfig, DEFAULT_MAIN_NAV, ALL_NAV_IDS } from "../use-nav-config";

describe("parseNavConfig", () => {
  it("returns DEFAULT_MAIN_NAV when input is undefined", () => {
    expect(parseNavConfig(undefined)).toEqual(DEFAULT_MAIN_NAV);
  });

  it("returns DEFAULT_MAIN_NAV when input is empty string", () => {
    expect(parseNavConfig("")).toEqual(DEFAULT_MAIN_NAV);
  });

  it("returns DEFAULT_MAIN_NAV when JSON is invalid", () => {
    expect(parseNavConfig("not-json")).toEqual(DEFAULT_MAIN_NAV);
  });

  it("returns DEFAULT_MAIN_NAV when array is empty", () => {
    expect(parseNavConfig(JSON.stringify([]))).toEqual(DEFAULT_MAIN_NAV);
  });

  it("returns DEFAULT_MAIN_NAV when array has more than 4 items", () => {
    expect(
      parseNavConfig(JSON.stringify(["dashboard", "transactions", "accounts", "budgets", "debts"]))
    ).toEqual(DEFAULT_MAIN_NAV);
  });

  it("accepts valid 2-item array (partial nav config)", () => {
    const partial = ["debts", "reports"];
    expect(parseNavConfig(JSON.stringify(partial))).toEqual(partial);
  });

  it("returns DEFAULT_MAIN_NAV when array contains invalid ids", () => {
    expect(
      parseNavConfig(JSON.stringify(["dashboard", "transactions", "accounts", "INVALID"]))
    ).toEqual(DEFAULT_MAIN_NAV);
  });

  it("returns parsed array when valid 4-item array of known ids", () => {
    const custom = ["debts", "recurring", "reports", "settings"];
    expect(parseNavConfig(JSON.stringify(custom))).toEqual(custom);
  });

  it("returns DEFAULT_MAIN_NAV when array contains duplicate ids", () => {
    expect(
      parseNavConfig(JSON.stringify(["dashboard", "dashboard", "accounts", "budgets"]))
    ).toEqual(DEFAULT_MAIN_NAV);
  });

  it("DEFAULT_MAIN_NAV has exactly 4 items all in ALL_NAV_IDS", () => {
    expect(DEFAULT_MAIN_NAV).toHaveLength(4);
    DEFAULT_MAIN_NAV.forEach((id) => expect(ALL_NAV_IDS).toContain(id));
  });
});
