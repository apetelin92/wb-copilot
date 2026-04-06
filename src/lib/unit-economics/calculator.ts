import type {
  BusinessInterpretation,
  CostBreakdownItem,
  MarginStatus,
  UnitEconomicsInput,
  UnitEconomicsResult,
  UnitEconomicsValidation
} from "@/lib/unit-economics/types";

function clampMoney(value: number) {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}

function getRate(mode: "amount" | "percent", value: number) {
  return mode === "percent" ? clampMoney(value) / 100 : 0;
}

function getFixedAmount(mode: "amount" | "percent", value: number) {
  return mode === "amount" ? clampMoney(value) : 0;
}

function getMarginStatus(input: { contributionProfit: number; marginPercent: number; priceBufferRub: number | null }): MarginStatus {
  if (input.contributionProfit < 0) {
    return "loss_making";
  }

  if (input.marginPercent < 15 || (input.priceBufferRub !== null && input.priceBufferRub < 150)) {
    return "at_risk";
  }

  return "profitable";
}

function getStatusLabel(status: MarginStatus) {
  if (status === "loss_making") {
    return "Убыточный";
  }

  if (status === "at_risk") {
    return "На грани";
  }

  return "Прибыльный";
}

function getDangerousFieldKeys(input: UnitEconomicsInput, result: {
  revenuePerUnit: number;
  breakEvenPrice: number | null;
  maxAdSpend: number;
  maxCostPrice: number;
  marketplaceCommission: number;
  taxCost: number;
}): Array<keyof UnitEconomicsInput> {
  const dangerKeys = new Set<keyof UnitEconomicsInput>();
  const safeRevenue = Math.max(result.revenuePerUnit, 1);

  if (result.breakEvenPrice !== null && input.salePrice <= result.breakEvenPrice * 1.03) {
    dangerKeys.add("salePrice");
  }

  if (input.adsCost >= result.maxAdSpend * 0.85 && result.maxAdSpend > 0) {
    dangerKeys.add("adsCost");
  }

  if (input.costPrice >= result.maxCostPrice * 0.85 && result.maxCostPrice > 0) {
    dangerKeys.add("costPrice");
  }

  if (result.marketplaceCommission / safeRevenue > 0.18) {
    dangerKeys.add("commissionValue");
  }

  if (input.logisticsCost / safeRevenue > 0.12) {
    dangerKeys.add("logisticsCost");
  }

  if (input.returnsCost / safeRevenue > 0.08) {
    dangerKeys.add("returnsCost");
  }

  if (result.taxCost / safeRevenue > 0.08) {
    dangerKeys.add("taxValue");
  }

  return [...dangerKeys];
}

function getInterpretation(input: UnitEconomicsInput, result: {
  status: MarginStatus;
  contributionProfit: number;
  marginPercent: number;
  largestCostDrivers: string[];
  revenuePerUnit: number;
  totalCostPerUnit: number;
  breakEvenPrice: number | null;
  maxAdSpend: number;
  maxCostPrice: number;
}): BusinessInterpretation {
  const driversText = result.largestCostDrivers.slice(0, 2).join(" и ");

  if (result.status === "profitable") {
    return {
      title: "SKU выглядит прибыльным",
      summary: `На единице остаётся ${roundMoney(result.contributionProfit).toFixed(0)} ₽, маржа ${roundPercent(result.marginPercent).toFixed(1)}%.`,
      details: [
        driversText ? `${driversText} остаются самыми заметными статьями расходов, но цена их пока уверенно покрывает.` : "Основные статьи расходов пока не съедают прибыль.",
        `Опасный уровень рекламы начинается примерно после ${roundMoney(result.maxAdSpend).toFixed(0)} ₽ на единицу.`,
        `Точка безубыточности по цене — около ${result.breakEvenPrice ? roundMoney(result.breakEvenPrice).toFixed(0) : "—"} ₽.`
      ]
    };
  }

  if (result.status === "at_risk") {
    return {
      title: "Маржа слишком низкая",
      summary: `SKU ещё не уходит в минус, но запас маленький: ${roundMoney(result.contributionProfit).toFixed(0)} ₽ на единицу и ${roundPercent(result.marginPercent).toFixed(1)}% маржи.`,
      details: [
        driversText ? `${driversText} занимают слишком большую долю цены и быстро съедают запас по марже.` : "Несколько статей расходов уже почти съедают весь вклад в прибыль.",
        `Реклама выше ${roundMoney(result.maxAdSpend).toFixed(0)} ₽ на единицу уже делает SKU опасным.`,
        `Себестоимость выше ${roundMoney(result.maxCostPrice).toFixed(0)} ₽ тоже начнёт уводить экономику в минус.`
      ]
    };
  }

  return {
    title: "SKU убыточный",
    summary: `При текущих условиях товар теряет ${Math.abs(roundMoney(result.contributionProfit)).toFixed(0)} ₽ на единицу и не покрывает все расходы.`,
    details: [
      driversText ? `Основные причины убытка — ${driversText}.` : "Расходы маркетплейса и себестоимость уже превышают допустимый уровень.",
      `Чтобы выйти в ноль, цена должна быть не ниже ${result.breakEvenPrice ? roundMoney(result.breakEvenPrice).toFixed(0) : "—"} ₽.`,
      `Либо нужно снижать себестоимость, логистику или рекламу: безопасный лимит рекламы сейчас всего ${roundMoney(result.maxAdSpend).toFixed(0)} ₽.`
    ]
  };
}

export function validateUnitEconomicsInput(input: UnitEconomicsInput): UnitEconomicsValidation {
  const validation: UnitEconomicsValidation = {};

  (Object.entries(input) as Array<[keyof UnitEconomicsInput, string | number]>).forEach(([key, value]) => {
    if (typeof value === "number" && (!Number.isFinite(value) || value < 0)) {
      validation[key] = "Укажите неотрицательное число.";
    }
  });

  if (input.salePrice <= 0) {
    validation.salePrice = "Цена продажи должна быть больше нуля.";
  }

  if (input.discountMode === "percent" && input.discountValue >= 100) {
    validation.discountValue = "Скидка в процентах должна быть меньше 100%.";
  }

  if (input.commissionMode === "percent" && input.commissionValue >= 100) {
    validation.commissionValue = "Комиссия в процентах должна быть меньше 100%.";
  }

  if (input.taxMode === "percent" && input.taxValue >= 100) {
    validation.taxValue = "Налог в процентах должен быть меньше 100%.";
  }

  return validation;
}

export function calculateUnitEconomics(input: UnitEconomicsInput): UnitEconomicsResult {
  const discountRate = getRate(input.discountMode, input.discountValue);
  const discountFixed = getFixedAmount(input.discountMode, input.discountValue);
  const commissionRate = getRate(input.commissionMode, input.commissionValue);
  const commissionFixed = getFixedAmount(input.commissionMode, input.commissionValue);
  const taxRate = getRate(input.taxMode, input.taxValue);
  const taxFixed = getFixedAmount(input.taxMode, input.taxValue);

  const revenueBeforePercentCosts = clampMoney(input.salePrice * (1 - discountRate) - discountFixed);
  const marketplaceCommission = roundMoney(commissionFixed + revenueBeforePercentCosts * commissionRate);
  const taxCost = roundMoney(taxFixed + revenueBeforePercentCosts * taxRate);
  const totalCostPerUnit = roundMoney(
    clampMoney(input.costPrice) +
      marketplaceCommission +
      clampMoney(input.logisticsCost) +
      clampMoney(input.storageCost) +
      clampMoney(input.packagingCost) +
      clampMoney(input.handlingCost) +
      clampMoney(input.adsCost) +
      clampMoney(input.returnsCost) +
      clampMoney(input.otherCosts) +
      taxCost
  );
  const contributionProfit = roundMoney(revenueBeforePercentCosts - totalCostPerUnit);
  const marginPercent = revenueBeforePercentCosts > 0 ? roundPercent((contributionProfit / revenueBeforePercentCosts) * 100) : 0;

  const fixedCostsWithoutRevenueRates =
    clampMoney(input.costPrice) +
    clampMoney(input.logisticsCost) +
    clampMoney(input.storageCost) +
    clampMoney(input.packagingCost) +
    clampMoney(input.handlingCost) +
    clampMoney(input.adsCost) +
    clampMoney(input.returnsCost) +
    clampMoney(input.otherCosts) +
    commissionFixed +
    taxFixed;
  const variableRevenueKeepRate = 1 - commissionRate - taxRate;
  const variablePriceKeepRate = 1 - discountRate;
  const breakEvenPrice =
    variableRevenueKeepRate > 0 && variablePriceKeepRate > 0
      ? roundMoney((fixedCostsWithoutRevenueRates / variableRevenueKeepRate + discountFixed) / variablePriceKeepRate)
      : null;
  const nonAdsCosts = totalCostPerUnit - clampMoney(input.adsCost);
  const maxAdSpend = roundMoney(Math.max(revenueBeforePercentCosts - nonAdsCosts, 0));
  const maxCostPrice = roundMoney(
    Math.max(
      revenueBeforePercentCosts -
        (marketplaceCommission +
          clampMoney(input.logisticsCost) +
          clampMoney(input.storageCost) +
          clampMoney(input.packagingCost) +
          clampMoney(input.handlingCost) +
          clampMoney(input.adsCost) +
          clampMoney(input.returnsCost) +
          clampMoney(input.otherCosts) +
          taxCost),
      0
    )
  );
  const priceBufferRub = breakEvenPrice === null ? null : roundMoney(input.salePrice - breakEvenPrice);
  const status = getMarginStatus({ contributionProfit, marginPercent, priceBufferRub });
  const breakdownBase = [
    { key: "costPrice", label: "Себестоимость", value: clampMoney(input.costPrice), shareOfRevenuePct: 0, isPrimaryDriver: false },
    { key: "commission", label: "Комиссия маркетплейса", value: marketplaceCommission, shareOfRevenuePct: 0, isPrimaryDriver: false },
    { key: "logistics", label: "Логистика", value: clampMoney(input.logisticsCost), shareOfRevenuePct: 0, isPrimaryDriver: false },
    { key: "storage", label: "Хранение", value: clampMoney(input.storageCost), shareOfRevenuePct: 0, isPrimaryDriver: false },
    { key: "packaging", label: "Упаковка", value: clampMoney(input.packagingCost), shareOfRevenuePct: 0, isPrimaryDriver: false },
    { key: "handling", label: "Обработка", value: clampMoney(input.handlingCost), shareOfRevenuePct: 0, isPrimaryDriver: false },
    { key: "ads", label: "Реклама", value: clampMoney(input.adsCost), shareOfRevenuePct: 0, isPrimaryDriver: false },
    { key: "returns", label: "Возвраты", value: clampMoney(input.returnsCost), shareOfRevenuePct: 0, isPrimaryDriver: false },
    { key: "other", label: "Прочие расходы", value: clampMoney(input.otherCosts), shareOfRevenuePct: 0, isPrimaryDriver: false },
    { key: "tax", label: "Налог", value: taxCost, shareOfRevenuePct: 0, isPrimaryDriver: false }
  ] satisfies CostBreakdownItem[];

  const breakdown: CostBreakdownItem[] = breakdownBase
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value)
    .map((item, index) => ({
      ...item,
      shareOfRevenuePct: revenueBeforePercentCosts > 0 ? roundPercent((item.value / revenueBeforePercentCosts) * 100) : 0,
      isPrimaryDriver: index < 3
    }));
  const largestCostDrivers = breakdown.filter((item) => item.isPrimaryDriver).map((item) => item.label);
  const dangerousFieldKeys = getDangerousFieldKeys(input, {
    revenuePerUnit: revenueBeforePercentCosts,
    breakEvenPrice,
    maxAdSpend,
    maxCostPrice,
    marketplaceCommission,
    taxCost
  });

  return {
    revenuePerUnit: roundMoney(revenueBeforePercentCosts),
    discountAmount: roundMoney(clampMoney(input.salePrice) - revenueBeforePercentCosts),
    marketplaceCommission,
    taxCost,
    totalCostPerUnit,
    contributionProfit,
    marginPercent,
    breakEvenPrice,
    maxAdSpend,
    maxCostPrice,
    status,
    statusLabel: getStatusLabel(status),
    priceBufferRub,
    largestCostDrivers,
    dangerousFieldKeys,
    breakdown,
    interpretation: getInterpretation(input, {
      status,
      contributionProfit,
      marginPercent,
      largestCostDrivers,
      revenuePerUnit: revenueBeforePercentCosts,
      totalCostPerUnit,
      breakEvenPrice,
      maxAdSpend,
      maxCostPrice
    })
  };
}
