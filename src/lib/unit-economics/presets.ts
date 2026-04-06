import type { MarketplacePreset, UnitEconomicsInput } from "@/lib/unit-economics/types";

export type MarketplaceCopy = {
  label: string;
  description: string;
  commissionLabel: string;
  commissionHint: string;
  returnsLabel: string;
};

const baseDefaults: Omit<UnitEconomicsInput, "marketplacePreset"> = {
  skuName: "",
  salePrice: 1990,
  costPrice: 780,
  commissionMode: "percent",
  commissionValue: 19,
  logisticsCost: 85,
  storageCost: 8,
  packagingCost: 25,
  handlingCost: 18,
  adsCost: 150,
  returnsCost: 40,
  otherCosts: 10,
  taxMode: "percent",
  taxValue: 6,
  discountMode: "percent",
  discountValue: 0
};

export const MARKETPLACE_PRESETS: Record<MarketplacePreset, { defaults: UnitEconomicsInput; copy: MarketplaceCopy }> = {
  manual: {
    defaults: {
      ...baseDefaults,
      marketplacePreset: "manual",
      commissionValue: 15,
      logisticsCost: 70,
      storageCost: 5,
      adsCost: 120,
      returnsCost: 30
    },
    copy: {
      label: "Ручной режим",
      description: "Подходит, если вы хотите ввести свою экономику без привязки к конкретному маркетплейсу.",
      commissionLabel: "Комиссия маркетплейса",
      commissionHint: "Можно указать в процентах от выручки или фиксированной суммой на единицу.",
      returnsLabel: "Возвраты / обратная логистика"
    }
  },
  wildberries: {
    defaults: {
      ...baseDefaults,
      marketplacePreset: "wildberries"
    },
    copy: {
      label: "Wildberries",
      description: "Быстрый режим для WB с типичными полями продавца и разумными стартовыми значениями.",
      commissionLabel: "Комиссия WB",
      commissionHint: "Обычно считается как процент от выручки после скидки и акции.",
      returnsLabel: "Возвраты и обратная логистика WB"
    }
  },
  ozon: {
    defaults: {
      ...baseDefaults,
      marketplacePreset: "ozon",
      commissionValue: 18,
      logisticsCost: 95,
      storageCost: 10,
      adsCost: 170,
      returnsCost: 35
    },
    copy: {
      label: "Ozon",
      description: "Быстрый режим для Ozon с отдельным акцентом на комиссию и логистику на единицу.",
      commissionLabel: "Комиссия Ozon",
      commissionHint: "Можно ввести процент или фактическую сумму на единицу, если она уже известна.",
      returnsLabel: "Возвраты и обработка возвратов"
    }
  }
};
