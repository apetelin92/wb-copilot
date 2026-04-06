import type { UnitEconomicsInput } from "@/lib/unit-economics/types";

function encodeUtf8(value: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64");
  }

  return btoa(unescape(encodeURIComponent(value)));
}

function decodeUtf8(value: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "base64").toString("utf8");
  }

  return decodeURIComponent(escape(atob(value)));
}

export function encodeUnitEconomicsDraft(input: UnitEconomicsInput) {
  return encodeUtf8(JSON.stringify(input));
}

export function decodeUnitEconomicsDraft(value: string): UnitEconomicsInput | null {
  try {
    return JSON.parse(decodeUtf8(value)) as UnitEconomicsInput;
  } catch {
    return null;
  }
}
