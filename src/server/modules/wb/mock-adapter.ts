import { addUtcDays, enumerateUtcDays, formatDateKey } from "@/server/lib/date";
import { DEFAULT_DEMO_SCENARIO_KEY, type DemoScenarioKey } from "@/server/modules/demo/scenarios";

import type {
  WbAdapter,
  WbCredentials,
  WbFeeRecord,
  WbProduct,
  WbPayoutRecord,
  WbSaleRecord,
  WbSyncParams,
  WbSyncPayload
} from "@/server/modules/wb/types";

type ProductProfile = {
  product: WbProduct;
  unitPriceRub: number;
  baseUnits: number;
  weekendBoost: number;
  cycleOffset: number;
  discountRate: number;
  commissionRate: number;
  logisticsPerUnitRub: number;
  storagePerUnitRub: number;
  returnEveryDays?: number;
  returnUnits?: number;
  returnCostPerUnitRub: number;
  reverseLogisticsPerUnitRub: number;
  trend: "up" | "down" | "flat";
  penaltyEveryDays?: number;
  penaltyRub?: number;
  promoEveryDays?: number;
  promoDiscountRate?: number;
};

type ProductFamilySeed = {
  nmIdStart: number;
  vendorPrefix: string;
  baseTitle: string;
  brand: string;
  subject: string;
  unitPriceRub: number;
  baseUnits: number;
  weekendBoost: number;
  cycleOffset: number;
  discountRate: number;
  commissionRate: number;
  logisticsPerUnitRub: number;
  storagePerUnitRub: number;
  returnEveryDays?: number;
  returnUnits?: number;
  returnCostPerUnitRub: number;
  reverseLogisticsPerUnitRub: number;
  trend: "up" | "down" | "flat";
  penaltyEveryDays?: number;
  penaltyRub?: number;
  promoEveryDays?: number;
  promoDiscountRate?: number;
};

type ProductVariant = {
  suffix: string;
  titleSuffix: string;
  vendorSuffix: string;
  unitPriceMultiplier: number;
  baseUnitsDelta: number;
  weekendBoostDelta: number;
  discountDelta: number;
  commissionDelta: number;
  logisticsMultiplier: number;
  storageMultiplier: number;
  returnEveryDaysShift?: number;
  returnUnitsDelta?: number;
  trend: "up" | "down" | "flat";
  penaltyEveryDays?: number;
  penaltyRubDelta?: number;
  promoEveryDays?: number;
  promoDiscountRateDelta?: number;
};

type ScenarioModifiers = {
  unitsMultiplier: number;
  discountDelta: number;
  commissionDelta: number;
  logisticsMultiplier: number;
  storageMultiplier: number;
  returnMultiplier: number;
  payoutLagDays: number;
  trendOverrides?: Partial<Record<string, ProductProfile["trend"]>>;
};

const CORE_PRODUCT_PROFILES: ProductProfile[] = [
  {
    product: {
      externalId: "prod-1001",
      nmId: "1001",
      vendorCode: "WB-MUG-001",
      title: "Thermal Travel Mug",
      brand: "North Cup",
      subject: "Drinkware"
    },
    unitPriceRub: 1290,
    baseUnits: 10,
    weekendBoost: 3,
    cycleOffset: 0,
    discountRate: 0.06,
    commissionRate: 0.15,
    logisticsPerUnitRub: 52,
    storagePerUnitRub: 8,
    returnEveryDays: 11,
    returnUnits: 1,
    returnCostPerUnitRub: 90,
    reverseLogisticsPerUnitRub: 22,
    trend: "flat"
  },
  {
    product: {
      externalId: "prod-1002",
      nmId: "1002",
      vendorCode: "WB-BAG-010",
      title: "Laptop Sleeve 14\"",
      brand: "Carry Lab",
      subject: "Accessories"
    },
    unitPriceRub: 1890,
    baseUnits: 8,
    weekendBoost: 2,
    cycleOffset: 2,
    discountRate: 0.08,
    commissionRate: 0.17,
    logisticsPerUnitRub: 61,
    storagePerUnitRub: 12,
    returnEveryDays: 6,
    returnUnits: 2,
    returnCostPerUnitRub: 110,
    reverseLogisticsPerUnitRub: 26,
    trend: "up",
    promoEveryDays: 9,
    promoDiscountRate: 0.16
  },
  {
    product: {
      externalId: "prod-1003",
      nmId: "1003",
      vendorCode: "WB-LAMP-005",
      title: "Desk Lamp Mini",
      brand: "Lightly",
      subject: "Home"
    },
    unitPriceRub: 2490,
    baseUnits: 13,
    weekendBoost: 4,
    cycleOffset: 1,
    discountRate: 0.09,
    commissionRate: 0.18,
    logisticsPerUnitRub: 84,
    storagePerUnitRub: 15,
    returnEveryDays: 8,
    returnUnits: 1,
    returnCostPerUnitRub: 130,
    reverseLogisticsPerUnitRub: 34,
    trend: "flat",
    penaltyEveryDays: 6,
    penaltyRub: 180
  },
  {
    product: {
      externalId: "prod-1004",
      nmId: "1004",
      vendorCode: "WB-MAT-004",
      title: "Yoga Mat Pro",
      brand: "Flexy",
      subject: "Fitness"
    },
    unitPriceRub: 2190,
    baseUnits: 7,
    weekendBoost: 5,
    cycleOffset: 4,
    discountRate: 0.11,
    commissionRate: 0.18,
    logisticsPerUnitRub: 96,
    storagePerUnitRub: 16,
    returnEveryDays: 4,
    returnUnits: 3,
    returnCostPerUnitRub: 170,
    reverseLogisticsPerUnitRub: 44,
    trend: "down",
    promoEveryDays: 5,
    promoDiscountRate: 0.2
  },
  {
    product: {
      externalId: "prod-1005",
      nmId: "1005",
      vendorCode: "WB-BOX-021",
      title: "Organizer Box Set",
      brand: "Orderly",
      subject: "Storage"
    },
    unitPriceRub: 1590,
    baseUnits: 6,
    weekendBoost: 1,
    cycleOffset: 5,
    discountRate: 0.05,
    commissionRate: 0.16,
    logisticsPerUnitRub: 48,
    storagePerUnitRub: 29,
    returnEveryDays: 10,
    returnUnits: 1,
    returnCostPerUnitRub: 80,
    reverseLogisticsPerUnitRub: 20,
    trend: "flat"
  },
  {
    product: {
      externalId: "prod-1006",
      nmId: "1006",
      vendorCode: "WB-LITE-017",
      title: "LED Fairy Lights",
      brand: "Glow Home",
      subject: "Decor"
    },
    unitPriceRub: 990,
    baseUnits: 15,
    weekendBoost: 2,
    cycleOffset: 3,
    discountRate: 0.17,
    commissionRate: 0.19,
    logisticsPerUnitRub: 58,
    storagePerUnitRub: 11,
    returnEveryDays: 7,
    returnUnits: 2,
    returnCostPerUnitRub: 95,
    reverseLogisticsPerUnitRub: 24,
    trend: "down",
    promoEveryDays: 4,
    promoDiscountRate: 0.25,
    penaltyEveryDays: 9,
    penaltyRub: 240
  },
  {
    product: {
      externalId: "prod-1007",
      nmId: "1007",
      vendorCode: "WB-PET-009",
      title: "Double Pet Bowl",
      brand: "Pet Nest",
      subject: "Pets"
    },
    unitPriceRub: 1390,
    baseUnits: 5,
    weekendBoost: 2,
    cycleOffset: 6,
    discountRate: 0.07,
    commissionRate: 0.16,
    logisticsPerUnitRub: 47,
    storagePerUnitRub: 10,
    returnEveryDays: 13,
    returnUnits: 1,
    returnCostPerUnitRub: 70,
    reverseLogisticsPerUnitRub: 18,
    trend: "up"
  },
  {
    product: {
      externalId: "prod-1008",
      nmId: "1008",
      vendorCode: "WB-HOME-028",
      title: "Bedding Set Soft Touch",
      brand: "Calm Home",
      subject: "Textile"
    },
    unitPriceRub: 2790,
    baseUnits: 9,
    weekendBoost: 4,
    cycleOffset: 2,
    discountRate: 0.1,
    commissionRate: 0.17,
    logisticsPerUnitRub: 74,
    storagePerUnitRub: 17,
    returnEveryDays: 9,
    returnUnits: 1,
    returnCostPerUnitRub: 125,
    reverseLogisticsPerUnitRub: 28,
    trend: "up",
    promoEveryDays: 12,
    promoDiscountRate: 0.15
  },
  {
    product: {
      externalId: "prod-1009",
      nmId: "1009",
      vendorCode: "WB-KID-012",
      title: "Kids Water Bottle",
      brand: "Tiny Trail",
      subject: "Kids"
    },
    unitPriceRub: 890,
    baseUnits: 18,
    weekendBoost: 3,
    cycleOffset: 1,
    discountRate: 0.14,
    commissionRate: 0.19,
    logisticsPerUnitRub: 39,
    storagePerUnitRub: 8,
    returnEveryDays: 5,
    returnUnits: 2,
    returnCostPerUnitRub: 78,
    reverseLogisticsPerUnitRub: 19,
    trend: "flat",
    promoEveryDays: 4,
    promoDiscountRate: 0.22,
    penaltyEveryDays: 10,
    penaltyRub: 150
  }
];

const EXTRA_PRODUCT_FAMILIES: ProductFamilySeed[] = [
  {
    nmIdStart: 1010,
    vendorPrefix: "WB-ORG",
    baseTitle: "Office Organizer",
    brand: "Workgrid",
    subject: "Office",
    unitPriceRub: 1240,
    baseUnits: 10,
    weekendBoost: 2,
    cycleOffset: 2,
    discountRate: 0.06,
    commissionRate: 0.16,
    logisticsPerUnitRub: 46,
    storagePerUnitRub: 9,
    returnEveryDays: 12,
    returnUnits: 1,
    returnCostPerUnitRub: 70,
    reverseLogisticsPerUnitRub: 18,
    trend: "flat"
  },
  {
    nmIdStart: 1013,
    vendorPrefix: "WB-CASE",
    baseTitle: "Phone Case",
    brand: "Griply",
    subject: "Accessories",
    unitPriceRub: 790,
    baseUnits: 22,
    weekendBoost: 3,
    cycleOffset: 4,
    discountRate: 0.12,
    commissionRate: 0.19,
    logisticsPerUnitRub: 28,
    storagePerUnitRub: 6,
    returnEveryDays: 6,
    returnUnits: 2,
    returnCostPerUnitRub: 58,
    reverseLogisticsPerUnitRub: 16,
    trend: "flat",
    promoEveryDays: 5,
    promoDiscountRate: 0.2
  },
  {
    nmIdStart: 1016,
    vendorPrefix: "WB-THERM",
    baseTitle: "Insulated Bottle",
    brand: "PeakSip",
    subject: "Sport",
    unitPriceRub: 1780,
    baseUnits: 9,
    weekendBoost: 4,
    cycleOffset: 1,
    discountRate: 0.08,
    commissionRate: 0.17,
    logisticsPerUnitRub: 52,
    storagePerUnitRub: 12,
    returnEveryDays: 9,
    returnUnits: 1,
    returnCostPerUnitRub: 96,
    reverseLogisticsPerUnitRub: 26,
    trend: "up"
  },
  {
    nmIdStart: 1019,
    vendorPrefix: "WB-STOR",
    baseTitle: "Storage Basket",
    brand: "Nestory",
    subject: "Home",
    unitPriceRub: 1490,
    baseUnits: 8,
    weekendBoost: 2,
    cycleOffset: 3,
    discountRate: 0.07,
    commissionRate: 0.16,
    logisticsPerUnitRub: 64,
    storagePerUnitRub: 18,
    returnEveryDays: 10,
    returnUnits: 1,
    returnCostPerUnitRub: 82,
    reverseLogisticsPerUnitRub: 22,
    trend: "flat"
  },
  {
    nmIdStart: 1022,
    vendorPrefix: "WB-MAT",
    baseTitle: "Fitness Band Set",
    brand: "Motiona",
    subject: "Fitness",
    unitPriceRub: 990,
    baseUnits: 16,
    weekendBoost: 2,
    cycleOffset: 5,
    discountRate: 0.11,
    commissionRate: 0.18,
    logisticsPerUnitRub: 37,
    storagePerUnitRub: 8,
    returnEveryDays: 7,
    returnUnits: 2,
    returnCostPerUnitRub: 74,
    reverseLogisticsPerUnitRub: 18,
    trend: "flat",
    promoEveryDays: 6,
    promoDiscountRate: 0.18
  },
  {
    nmIdStart: 1025,
    vendorPrefix: "WB-LAMP",
    baseTitle: "Night Lamp",
    brand: "Lunetto",
    subject: "Decor",
    unitPriceRub: 2190,
    baseUnits: 7,
    weekendBoost: 3,
    cycleOffset: 0,
    discountRate: 0.09,
    commissionRate: 0.18,
    logisticsPerUnitRub: 76,
    storagePerUnitRub: 14,
    returnEveryDays: 8,
    returnUnits: 1,
    returnCostPerUnitRub: 120,
    reverseLogisticsPerUnitRub: 30,
    trend: "down",
    penaltyEveryDays: 8,
    penaltyRub: 120
  },
  {
    nmIdStart: 1028,
    vendorPrefix: "WB-TOY",
    baseTitle: "Kids Puzzle Box",
    brand: "Tiny Spark",
    subject: "Kids",
    unitPriceRub: 1140,
    baseUnits: 13,
    weekendBoost: 4,
    cycleOffset: 6,
    discountRate: 0.1,
    commissionRate: 0.17,
    logisticsPerUnitRub: 41,
    storagePerUnitRub: 9,
    returnEveryDays: 11,
    returnUnits: 1,
    returnCostPerUnitRub: 66,
    reverseLogisticsPerUnitRub: 18,
    trend: "up"
  },
  {
    nmIdStart: 1031,
    vendorPrefix: "WB-PET",
    baseTitle: "Pet Toy Rope",
    brand: "Tailup",
    subject: "Pets",
    unitPriceRub: 860,
    baseUnits: 17,
    weekendBoost: 3,
    cycleOffset: 2,
    discountRate: 0.13,
    commissionRate: 0.18,
    logisticsPerUnitRub: 33,
    storagePerUnitRub: 7,
    returnEveryDays: 5,
    returnUnits: 2,
    returnCostPerUnitRub: 62,
    reverseLogisticsPerUnitRub: 17,
    trend: "flat",
    promoEveryDays: 4,
    promoDiscountRate: 0.22
  },
  {
    nmIdStart: 1034,
    vendorPrefix: "WB-TEXT",
    baseTitle: "Kitchen Towel Set",
    brand: "Softgrain",
    subject: "Textile",
    unitPriceRub: 1360,
    baseUnits: 12,
    weekendBoost: 2,
    cycleOffset: 1,
    discountRate: 0.06,
    commissionRate: 0.15,
    logisticsPerUnitRub: 44,
    storagePerUnitRub: 10,
    returnEveryDays: 14,
    returnUnits: 1,
    returnCostPerUnitRub: 60,
    reverseLogisticsPerUnitRub: 16,
    trend: "flat"
  },
  {
    nmIdStart: 1037,
    vendorPrefix: "WB-CARE",
    baseTitle: "Body Care Kit",
    brand: "Daily Ritual",
    subject: "Beauty",
    unitPriceRub: 1640,
    baseUnits: 11,
    weekendBoost: 3,
    cycleOffset: 4,
    discountRate: 0.09,
    commissionRate: 0.18,
    logisticsPerUnitRub: 48,
    storagePerUnitRub: 10,
    returnEveryDays: 8,
    returnUnits: 1,
    returnCostPerUnitRub: 86,
    reverseLogisticsPerUnitRub: 20,
    trend: "up"
  },
  {
    nmIdStart: 1040,
    vendorPrefix: "WB-CAMP",
    baseTitle: "Travel Cutlery Set",
    brand: "Nomad Fold",
    subject: "Travel",
    unitPriceRub: 980,
    baseUnits: 14,
    weekendBoost: 2,
    cycleOffset: 5,
    discountRate: 0.1,
    commissionRate: 0.17,
    logisticsPerUnitRub: 35,
    storagePerUnitRub: 8,
    returnEveryDays: 9,
    returnUnits: 1,
    returnCostPerUnitRub: 54,
    reverseLogisticsPerUnitRub: 15,
    trend: "flat"
  },
  {
    nmIdStart: 1043,
    vendorPrefix: "WB-DESK",
    baseTitle: "Desk Pad",
    brand: "Slateform",
    subject: "Office",
    unitPriceRub: 2090,
    baseUnits: 6,
    weekendBoost: 1,
    cycleOffset: 0,
    discountRate: 0.07,
    commissionRate: 0.16,
    logisticsPerUnitRub: 72,
    storagePerUnitRub: 13,
    returnEveryDays: 10,
    returnUnits: 1,
    returnCostPerUnitRub: 94,
    reverseLogisticsPerUnitRub: 24,
    trend: "down",
    penaltyEveryDays: 7,
    penaltyRub: 110
  }
];

const EXTRA_PRODUCT_VARIANTS: ProductVariant[] = [
  {
    suffix: "core",
    titleSuffix: "Core",
    vendorSuffix: "C",
    unitPriceMultiplier: 1,
    baseUnitsDelta: 0,
    weekendBoostDelta: 0,
    discountDelta: 0,
    commissionDelta: 0,
    logisticsMultiplier: 1,
    storageMultiplier: 1,
    trend: "flat"
  },
  {
    suffix: "lean",
    titleSuffix: "Lean",
    vendorSuffix: "L",
    unitPriceMultiplier: 0.9,
    baseUnitsDelta: -1,
    weekendBoostDelta: 0,
    discountDelta: -0.01,
    commissionDelta: 0,
    logisticsMultiplier: 0.92,
    storageMultiplier: 0.9,
    returnEveryDaysShift: 1,
    trend: "flat"
  },
  {
    suffix: "growth",
    titleSuffix: "Growth",
    vendorSuffix: "G",
    unitPriceMultiplier: 1.12,
    baseUnitsDelta: 3,
    weekendBoostDelta: 1,
    discountDelta: -0.02,
    commissionDelta: -0.005,
    logisticsMultiplier: 0.96,
    storageMultiplier: 1.04,
    returnEveryDaysShift: 2,
    trend: "up",
    promoEveryDays: 10,
    promoDiscountRateDelta: 0.02
  },
  {
    suffix: "hero",
    titleSuffix: "Hero",
    vendorSuffix: "H",
    unitPriceMultiplier: 1.2,
    baseUnitsDelta: 5,
    weekendBoostDelta: 2,
    discountDelta: -0.03,
    commissionDelta: -0.004,
    logisticsMultiplier: 1,
    storageMultiplier: 1.06,
    returnEveryDaysShift: 3,
    trend: "up",
    promoEveryDays: 12,
    promoDiscountRateDelta: 0.01
  },
  {
    suffix: "risk",
    titleSuffix: "Risk",
    vendorSuffix: "R",
    unitPriceMultiplier: 0.94,
    baseUnitsDelta: -2,
    weekendBoostDelta: 0,
    discountDelta: 0.05,
    commissionDelta: 0.008,
    logisticsMultiplier: 1.12,
    storageMultiplier: 1.1,
    returnEveryDaysShift: -2,
    returnUnitsDelta: 1,
    trend: "down",
    penaltyEveryDays: 6,
    penaltyRubDelta: 80,
    promoEveryDays: 5,
    promoDiscountRateDelta: 0.08
  },
  {
    suffix: "volatile",
    titleSuffix: "Volatile",
    vendorSuffix: "V",
    unitPriceMultiplier: 1.03,
    baseUnitsDelta: 1,
    weekendBoostDelta: 1,
    discountDelta: 0.02,
    commissionDelta: 0.005,
    logisticsMultiplier: 1.06,
    storageMultiplier: 1.08,
    returnEveryDaysShift: -1,
    returnUnitsDelta: 1,
    trend: "down",
    penaltyEveryDays: 9,
    penaltyRubDelta: 40,
    promoEveryDays: 7,
    promoDiscountRateDelta: 0.05
  }
];

function buildGeneratedProductProfiles() {
  return EXTRA_PRODUCT_FAMILIES.flatMap((seed) =>
    EXTRA_PRODUCT_VARIANTS.map((variant, index) => {
      const nmId = String(seed.nmIdStart + index * 100);
      const title = `${seed.baseTitle} ${variant.titleSuffix}`;
      const vendorCode = `${seed.vendorPrefix}-${variant.vendorSuffix}-${nmId.slice(-3)}`;

      return {
        product: {
          externalId: `prod-${nmId}`,
          nmId,
          vendorCode,
          title,
          brand: seed.brand,
          subject: seed.subject
        },
        unitPriceRub: Math.max(Math.round(seed.unitPriceRub * variant.unitPriceMultiplier), 450),
        baseUnits: Math.max(seed.baseUnits + variant.baseUnitsDelta, 1),
        weekendBoost: Math.max(seed.weekendBoost + variant.weekendBoostDelta, 0),
        cycleOffset: (seed.cycleOffset + index) % 7,
        discountRate: Math.max(0.02, Math.min(seed.discountRate + variant.discountDelta, 0.32)),
        commissionRate: Math.max(0.12, Math.min(seed.commissionRate + variant.commissionDelta, 0.24)),
        logisticsPerUnitRub: Math.max(Math.round(seed.logisticsPerUnitRub * variant.logisticsMultiplier), 18),
        storagePerUnitRub: Math.max(Math.round(seed.storagePerUnitRub * variant.storageMultiplier), 4),
        returnEveryDays: Math.max((seed.returnEveryDays ?? 12) + (variant.returnEveryDaysShift ?? 0), 3),
        returnUnits: Math.max((seed.returnUnits ?? 1) + (variant.returnUnitsDelta ?? 0), 1),
        returnCostPerUnitRub: seed.returnCostPerUnitRub,
        reverseLogisticsPerUnitRub: seed.reverseLogisticsPerUnitRub,
        trend: variant.trend,
        penaltyEveryDays: variant.penaltyEveryDays ?? seed.penaltyEveryDays,
        penaltyRub: (seed.penaltyRub ?? 0) + (variant.penaltyRubDelta ?? 0) || undefined,
        promoEveryDays: variant.promoEveryDays ?? seed.promoEveryDays,
        promoDiscountRate:
          variant.promoEveryDays || seed.promoEveryDays
            ? Math.max(0.08, Math.min((seed.promoDiscountRate ?? seed.discountRate) + (variant.promoDiscountRateDelta ?? 0), 0.38))
            : undefined
      } satisfies ProductProfile;
    })
  );
}

const PRODUCT_PROFILES: ProductProfile[] = [...CORE_PRODUCT_PROFILES, ...buildGeneratedProductProfiles()];

function getScenarioKey(credentials: WbCredentials): DemoScenarioKey {
  if (credentials.cabinetId?.includes("cash-risk")) {
    return "cash-risk";
  }

  if (credentials.cabinetId?.includes("decline")) {
    return "decline";
  }

  if (credentials.cabinetId?.includes("growth")) {
    return "growth";
  }

  return DEFAULT_DEMO_SCENARIO_KEY;
}

function getScenarioModifiers(scenarioKey: DemoScenarioKey): ScenarioModifiers {
  if (scenarioKey === "growth") {
    return {
      unitsMultiplier: 1.24,
      discountDelta: -0.02,
      commissionDelta: -0.005,
      logisticsMultiplier: 0.95,
      storageMultiplier: 1.02,
      returnMultiplier: 0.7,
      payoutLagDays: 0,
      trendOverrides: {
        "1002": "up",
        "1008": "up",
        "1009": "up"
      }
    };
  }

  if (scenarioKey === "decline") {
    return {
      unitsMultiplier: 0.78,
      discountDelta: 0.06,
      commissionDelta: 0.01,
      logisticsMultiplier: 1.12,
      storageMultiplier: 1.08,
      returnMultiplier: 1.7,
      payoutLagDays: 1,
      trendOverrides: {
        "1004": "down",
        "1006": "down",
        "1007": "flat"
      }
    };
  }

  return {
    unitsMultiplier: 0.96,
    discountDelta: 0.01,
    commissionDelta: 0.002,
    logisticsMultiplier: 1.04,
    storageMultiplier: 1.04,
    returnMultiplier: 1.05,
    payoutLagDays: 3,
    trendOverrides: {
      "1002": "flat",
      "1008": "flat"
    }
  };
}

function getScenarioProfiles(scenarioKey: DemoScenarioKey) {
  const modifiers = getScenarioModifiers(scenarioKey);

  return PRODUCT_PROFILES.map((profile) => ({
    ...profile,
    baseUnits: Math.max(Math.round(profile.baseUnits * modifiers.unitsMultiplier), 1),
    discountRate: Math.max(0, Math.min(profile.discountRate + modifiers.discountDelta, 0.35)),
    commissionRate: Math.max(0.1, profile.commissionRate + modifiers.commissionDelta),
    logisticsPerUnitRub: Math.round(profile.logisticsPerUnitRub * modifiers.logisticsMultiplier),
    storagePerUnitRub: Math.round(profile.storagePerUnitRub * modifiers.storageMultiplier),
    returnUnits: Math.max(Math.round((profile.returnUnits ?? 1) * modifiers.returnMultiplier), 1),
    trend: modifiers.trendOverrides?.[profile.product.nmId] ?? profile.trend
  }));
}

function buildSoldUnits(profile: ProductProfile, dayIndex: number, weekday: number) {
  const cycleDelta = ((dayIndex + profile.cycleOffset) % 7) - 3;
  const weekendDelta = weekday === 5 || weekday === 6 ? profile.weekendBoost : 0;
  const trendDelta =
    profile.trend === "up"
      ? Math.floor(dayIndex / 9)
      : profile.trend === "down"
        ? -Math.floor(dayIndex / 11)
        : 0;
  const soldUnits = profile.baseUnits + cycleDelta + weekendDelta + trendDelta;

  return Math.max(soldUnits, 1);
}

function buildSales(params: WbSyncParams, profiles: ProductProfile[]): WbSaleRecord[] {
  const days = enumerateUtcDays(params.fromDate, params.toDate);

  return days.flatMap((day, dayIndex) =>
    profiles.map((profile) => {
      const weekday = day.getUTCDay();
      const soldUnits = buildSoldUnits(profile, dayIndex, weekday);
      const returnedUnits =
        profile.returnEveryDays && dayIndex % profile.returnEveryDays === 0 ? profile.returnUnits ?? 1 : 0;
      const effectiveDiscountRate =
        profile.promoEveryDays && dayIndex % profile.promoEveryDays === 0
          ? profile.promoDiscountRate ?? profile.discountRate
          : profile.discountRate;
      const grossRevenueRub = soldUnits * profile.unitPriceRub;
      const discountRub = grossRevenueRub * effectiveDiscountRate;
      const refundRub = returnedUnits * profile.unitPriceRub;

      return {
        externalId: `sale-${profile.product.nmId}-${formatDateKey(day)}`,
        nmId: profile.product.nmId,
        recordDate: day,
        soldUnits,
        returnedUnits,
        grossRevenueRub,
        discountRub,
        refundRub
      };
    })
  );
}

function buildFees(sales: WbSaleRecord[], profiles: ProductProfile[]): WbFeeRecord[] {
  return sales.map((sale, index) => {
    const profile = profiles.find((item) => item.product.nmId === sale.nmId)!;
    const dayKey = Math.floor(sale.recordDate.getTime() / (24 * 60 * 60 * 1000));
    const netRevenue = sale.grossRevenueRub - sale.discountRub - sale.refundRub;
    const commissionRub = netRevenue * profile.commissionRate;
    const logisticsRub =
      sale.soldUnits * profile.logisticsPerUnitRub +
      sale.returnedUnits * profile.reverseLogisticsPerUnitRub +
      (index % 4 === 0 ? 12 : 0);
    const storageRub = sale.soldUnits * profile.storagePerUnitRub + (dayKey % 10 === 0 ? profile.storagePerUnitRub * 2 : 0);
    const penaltyRub =
      profile.penaltyEveryDays && dayKey % profile.penaltyEveryDays === 0 ? profile.penaltyRub ?? 0 : 0;
    const returnCostRub = sale.returnedUnits * profile.returnCostPerUnitRub;

    return {
      externalId: `fee-${sale.nmId}-${formatDateKey(sale.recordDate)}`,
      nmId: sale.nmId,
      recordDate: sale.recordDate,
      commissionRub,
      logisticsRub,
      storageRub,
      penaltyRub,
      returnCostRub
    };
  });
}

function buildPayouts(sales: WbSaleRecord[], fees: WbFeeRecord[], params: WbSyncParams, payoutLagDays: number): WbPayoutRecord[] {
  const feeMap = new Map(fees.map((fee) => [`${fee.nmId}:${fee.recordDate.toISOString()}`, fee]));
  const payoutMap = new Map<string, number>();

  sales.forEach((sale) => {
    const fee = feeMap.get(`${sale.nmId}:${sale.recordDate.toISOString()}`);
    const expectedNet =
      sale.grossRevenueRub -
      sale.discountRub -
      sale.refundRub -
      (fee?.commissionRub ?? 0) -
      (fee?.logisticsRub ?? 0) -
      (fee?.storageRub ?? 0) -
      (fee?.penaltyRub ?? 0) -
      (fee?.returnCostRub ?? 0);
    const payoutDate = addUtcDays(sale.recordDate, 3 + (Number(sale.nmId) % 2) + payoutLagDays);
    const key = formatDateKey(payoutDate);
    payoutMap.set(key, (payoutMap.get(key) ?? 0) + expectedNet);
  });

  return enumerateUtcDays(addUtcDays(params.fromDate, 3), addUtcDays(params.toDate, 5)).flatMap((date) => {
    const key = formatDateKey(date);
    const amountRub = payoutMap.get(key);

    if (!amountRub) {
      return [];
    }

    return {
      externalId: `payout-${key}`,
      payoutDate: date,
      amountRub
    };
  });
}

export class MockWbAdapter implements WbAdapter {
  async verifyConnection(credentials: WbCredentials) {
    return {
      accountName: credentials.name || "Демо кабинет WB",
      cabinetId: credentials.cabinetId ?? "mock-cabinet"
    };
  }

  async fetchDailySnapshot(_credentials: WbCredentials, params: WbSyncParams): Promise<WbSyncPayload> {
    const scenarioKey = getScenarioKey(_credentials);
    const scenarioModifiers = getScenarioModifiers(scenarioKey);
    const scenarioProfiles = getScenarioProfiles(scenarioKey);
    const sales = buildSales(params, scenarioProfiles);
    const fees = buildFees(sales, scenarioProfiles);
    const payouts = buildPayouts(sales, fees, params, scenarioModifiers.payoutLagDays);

    return {
      products: scenarioProfiles.map((item) => item.product),
      sales,
      fees,
      payouts
    };
  }
}
