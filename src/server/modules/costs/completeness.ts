import { toNumber } from "../../lib/number";

type ManualCostFields = {
  cogsRub: unknown;
  packagingRub: unknown;
  handlingRub: unknown;
  otherUnitCostRub: unknown;
  isComplete?: boolean;
};

export function getMissingManualCostFields(profile: ManualCostFields | null | undefined) {
  if (!profile) {
    return ["себестоимость", "упаковка", "обработка", "прочие ручные затраты"];
  }

  const missing = [] as string[];

  if (toNumber(profile.cogsRub as number | null | undefined) <= 0) {
    missing.push("себестоимость");
  }

  if (toNumber(profile.packagingRub as number | null | undefined) <= 0) {
    missing.push("упаковка");
  }

  if (toNumber(profile.handlingRub as number | null | undefined) <= 0) {
    missing.push("обработка");
  }

  if (toNumber(profile.otherUnitCostRub as number | null | undefined) <= 0) {
    missing.push("прочие ручные затраты");
  }

  return missing;
}

export function hasCompleteManualCosts(profile: ManualCostFields | null | undefined) {
  if (!profile) {
    return false;
  }

  if (profile.isComplete === false) {
    return false;
  }

  return getMissingManualCostFields(profile).length === 0;
}
