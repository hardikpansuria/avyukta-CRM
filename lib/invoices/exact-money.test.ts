import { describe, expect, it } from "vitest";

import { centsToMoney, moneyToCents } from "./exact-money";

describe("exact invoice money arithmetic", () => {
  it("converts database decimal strings to exact cents", () => {
    expect(moneyToCents("13560.00")).toBe(BigInt(1_356_000));
    expect(moneyToCents("0.01")).toBe(BigInt(1));
    expect(moneyToCents("-12.30")).toBe(BigInt(-1_230));
  });

  it("formats exact cents without floating-point rounding", () => {
    expect(centsToMoney(BigInt(678_000))).toBe("6780.00");
    expect(centsToMoney(BigInt(-1))).toBe("-0.01");
  });

  it("rejects values with more than two currency decimals", () => {
    expect(() => moneyToCents("10.001")).toThrow("Invalid currency amount");
  });
});

