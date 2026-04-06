import test from "node:test";
import assert from "node:assert/strict";

import { calculateUnitEconomics } from "../src/lib/unit-economics/calculator";
import { MARKETPLACE_PRESETS } from "../src/lib/unit-economics/presets";

const baseInput = MARKETPLACE_PRESETS.wildberries.defaults;

test("profitable SKU scenario", () => {
  const result = calculateUnitEconomics({
    ...baseInput,
    salePrice: 2490,
    costPrice: 780,
    adsCost: 110,
    logisticsCost: 70,
    returnsCost: 20
  });

  assert.equal(result.status, "profitable");
  assert.ok(result.contributionProfit > 0);
  assert.ok(result.marginPercent >= 15);
});

test("low-margin SKU scenario", () => {
  const result = calculateUnitEconomics({
    ...baseInput,
    salePrice: 1790,
    costPrice: 860,
    adsCost: 180,
    logisticsCost: 95,
    returnsCost: 45
  });

  assert.equal(result.status, "at_risk");
  assert.ok(result.contributionProfit >= 0);
  assert.ok(result.marginPercent < 15);
});

test("loss-making SKU scenario", () => {
  const result = calculateUnitEconomics({
    ...baseInput,
    salePrice: 1490,
    costPrice: 900,
    adsCost: 260,
    logisticsCost: 120,
    returnsCost: 80,
    otherCosts: 50
  });

  assert.equal(result.status, "loss_making");
  assert.ok(result.contributionProfit < 0);
});

test("break-even price logic returns non-loss threshold", () => {
  const result = calculateUnitEconomics({
    ...baseInput,
    salePrice: 1990,
    costPrice: 780,
    adsCost: 150
  });

  assert.ok(result.breakEvenPrice);
  const atBreakEven = calculateUnitEconomics({
    ...baseInput,
    salePrice: result.breakEvenPrice ?? 0,
    costPrice: 780,
    adsCost: 150
  });

  assert.ok(Math.abs(atBreakEven.contributionProfit) <= 2);
});

test("max ad spend logic matches zero-profit threshold", () => {
  const result = calculateUnitEconomics({
    ...baseInput,
    salePrice: 2190,
    costPrice: 780,
    adsCost: 120
  });

  const atAdLimit = calculateUnitEconomics({
    ...baseInput,
    salePrice: 2190,
    costPrice: 780,
    adsCost: result.maxAdSpend
  });

  assert.ok(Math.abs(atAdLimit.contributionProfit) <= 2);
  assert.ok(result.maxAdSpend >= 0);
});
