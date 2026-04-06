import test from "node:test";
import assert from "node:assert/strict";

import { getMissingManualCostFields, hasCompleteManualCosts } from "../src/server/modules/costs/completeness";

test("cost completeness detects missing manual fields", () => {
  const missing = getMissingManualCostFields({
    cogsRub: 100,
    packagingRub: 0,
    handlingRub: 10,
    otherUnitCostRub: 0,
    isComplete: true
  });

  assert.deepEqual(missing, ["упаковка", "прочие ручные затраты"]);
});

test("cost completeness requires explicit complete profile and all fields", () => {
  assert.equal(
    hasCompleteManualCosts({
      cogsRub: 100,
      packagingRub: 10,
      handlingRub: 10,
      otherUnitCostRub: 10,
      isComplete: true
    }),
    true
  );

  assert.equal(
    hasCompleteManualCosts({
      cogsRub: 100,
      packagingRub: 10,
      handlingRub: 10,
      otherUnitCostRub: 10,
      isComplete: false
    }),
    false
  );
});
