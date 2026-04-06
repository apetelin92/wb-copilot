export type MonetaryMode = "amount" | "percent";
export type MarketplacePreset = "manual" | "wildberries" | "ozon";
export type MarginStatus = "profitable" | "at_risk" | "loss_making";

export type UnitEconomicsInput = {
  skuName?: string;
  marketplacePreset: MarketplacePreset;
  salePrice: number;
  costPrice: number;
  commissionMode: MonetaryMode;
  commissionValue: number;
  logisticsCost: number;
  storageCost: number;
  packagingCost: number;
  handlingCost: number;
  adsCost: number;
  returnsCost: number;
  otherCosts: number;
  taxMode: MonetaryMode;
  taxValue: number;
  discountMode: MonetaryMode;
  discountValue: number;
};

export type UnitEconomicsValidation = Partial<Record<keyof UnitEconomicsInput, string>>;

export type CostBreakdownItem = {
  key:
    | "costPrice"
    | "commission"
    | "logistics"
    | "storage"
    | "packaging"
    | "handling"
    | "ads"
    | "returns"
    | "other"
    | "tax";
  label: string;
  value: number;
  shareOfRevenuePct: number;
  isPrimaryDriver: boolean;
};

export type BusinessInterpretation = {
  title: string;
  summary: string;
  details: string[];
};

export type UnitEconomicsResult = {
  revenuePerUnit: number;
  discountAmount: number;
  marketplaceCommission: number;
  taxCost: number;
  totalCostPerUnit: number;
  contributionProfit: number;
  marginPercent: number;
  breakEvenPrice: number | null;
  maxAdSpend: number;
  maxCostPrice: number;
  status: MarginStatus;
  statusLabel: string;
  priceBufferRub: number | null;
  largestCostDrivers: string[];
  dangerousFieldKeys: Array<keyof UnitEconomicsInput>;
  breakdown: CostBreakdownItem[];
  interpretation: BusinessInterpretation;
};
