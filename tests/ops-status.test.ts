import test from "node:test";
import assert from "node:assert/strict";

import { SyncRunStatus } from "@prisma/client";

import { buildSyncFreshnessStatus, humanizeSyncErrorMessage } from "../src/server/modules/ops-status/helpers";

test("freshness reports never when sync has not run", () => {
  const result = buildSyncFreshnessStatus({
    latestCompletedAt: null,
    latestSyncStatus: null,
    latestSyncStartedAt: null,
    latestFailureMessage: null,
    staleAfterHours: 24
  });

  assert.equal(result.state, "never");
});

test("freshness reports failed when latest run failed after last success", () => {
  const now = new Date();
  const lastSuccess = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const lastFailed = new Date(now.getTime() - 60 * 60 * 1000);
  const result = buildSyncFreshnessStatus({
    latestCompletedAt: lastSuccess,
    latestSyncStatus: SyncRunStatus.FAILED,
    latestSyncStartedAt: lastFailed,
    latestFailureMessage: "WB request failed after retries.",
    staleAfterHours: 24
  });

  assert.equal(result.state, "failed");
});

test("humanize sync error maps wb retry failure", () => {
  assert.match(humanizeSyncErrorMessage("WB request failed after retries.") ?? "", /не удалось связаться/i);
});
