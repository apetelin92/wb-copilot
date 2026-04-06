import test from "node:test";
import assert from "node:assert/strict";

import { buildStartupAudit } from "../src/server/modules/ops-audit/service";
import { assessSkuHealth } from "../src/server/modules/sku/health";

test("incomplete economics status is detected", () => {
  const result = assessSkuHealth({
    contributionProfitRub: 320,
    marginPct: 0.22,
    soldUnits: 12,
    returnedUnits: 0,
    hasIncompleteCosts: true
  });

  assert.equal(result.status, "incomplete");
  assert.equal(result.requiresAttention, true);
});

test("loss-making status remains stronger than incomplete-looking profit", () => {
  const result = assessSkuHealth({
    contributionProfitRub: -450,
    marginPct: -0.11,
    soldUnits: 8,
    returnedUnits: 0,
    hasIncompleteCosts: false
  });

  assert.equal(result.status, "loss");
  assert.match(result.action, /цен/i);
});

test("startup audit summarizes counts and top actions", () => {
  const audit = buildStartupAudit({
    completedSyncCount: 1,
    riskLevel: "WATCH",
    metrics: [
      {
        skuId: "sku-1",
        title: "SKU 1",
        contributionProfitRub: -600,
        marginPct: -0.2,
        soldUnits: 10,
        returnedUnits: 0,
        hasIncompleteCosts: false
      },
      {
        skuId: "sku-2",
        title: "SKU 2",
        contributionProfitRub: 120,
        marginPct: 0.1,
        soldUnits: 10,
        returnedUnits: 0,
        hasIncompleteCosts: false
      },
      {
        skuId: "sku-3",
        title: "SKU 3",
        contributionProfitRub: 300,
        marginPct: 0.2,
        soldUnits: 10,
        returnedUnits: 0,
        hasIncompleteCosts: true
      }
    ]
  });

  assert.equal(audit.isVisible, true);
  assert.equal(audit.lossMakingSkuCount, 1);
  assert.equal(audit.atRiskSkuCount, 1);
  assert.equal(audit.incompleteEconomicsCount, 1);
  assert.equal(audit.topReasons.length > 0, true);
  assert.equal(audit.topActions.length > 0, true);
});

test("startup audit hides after initial startup window", () => {
  const audit = buildStartupAudit({
    completedSyncCount: 4,
    riskLevel: "CLEAR",
    metrics: []
  });

  assert.equal(audit.isVisible, false);
});
