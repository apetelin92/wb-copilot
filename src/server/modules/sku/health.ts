export type SkuHealthStatus = "loss" | "incomplete" | "at_risk" | "profitable";

export type SkuHealthInput = {
  contributionProfitRub: number;
  marginPct: number;
  soldUnits: number;
  returnedUnits: number;
  hasIncompleteCosts: boolean;
};

export type SkuHealthAssessment = {
  status: SkuHealthStatus;
  statusLabel: string;
  requiresAttention: boolean;
  returnRate: number;
  reason: string;
  action: string;
};

function getReturnRate(input: Pick<SkuHealthInput, "soldUnits" | "returnedUnits">) {
  return input.soldUnits > 0 ? input.returnedUnits / input.soldUnits : 0;
}

export function assessSkuHealth(input: SkuHealthInput): SkuHealthAssessment {
  const returnRate = getReturnRate(input);

  if (input.contributionProfitRub < 0) {
    if (input.hasIncompleteCosts) {
      return {
        status: "loss",
        statusLabel: "Убыточный SKU",
        requiresAttention: true,
        returnRate,
        reason:
          returnRate >= 0.12
            ? "SKU уже в минусе, а часть затрат не заполнена. Возвраты дополнительно усиливают потери."
            : "SKU уже в минусе, а экономика по нему ещё неполная. Реальный убыток может быть выше.",
        action: returnRate >= 0.12 ? "Сначала закройте cost data и проверьте возвраты." : "Сначала закройте cost data, потом пересчитайте цену."
      };
    }

    if (returnRate >= 0.18) {
      return {
        status: "loss",
        statusLabel: "Убыточный SKU",
        requiresAttention: true,
        returnRate,
        reason: "Возвраты уже критичные: обратная логистика и списания съедают экономику быстрее цены.",
        action: "Остановите масштабирование и разберите причину возвратов."
      };
    }

    if (returnRate >= 0.12) {
      return {
        status: "loss",
        statusLabel: "Убыточный SKU",
        requiresAttention: true,
        returnRate,
        reason: "Возвраты и обратная логистика уже съедают слишком большую часть маржи.",
        action: "Проверьте возвраты и не лейте трафик до пересчёта."
      };
    }

    if (input.marginPct <= -0.05) {
      return {
        status: "loss",
        statusLabel: "Убыточный SKU",
        requiresAttention: true,
        returnRate,
        reason: "Отрицательная маржа слишком глубокая: текущая цена уже заметно ниже безопасного уровня.",
        action: "Поднимите цену или временно уберите SKU из активного продвижения."
      };
    }

    if (input.marginPct <= 0) {
      return {
        status: "loss",
        statusLabel: "Убыточный SKU",
        requiresAttention: true,
        returnRate,
        reason: "Цена больше не покрывает расходы маркетплейса и закупку.",
        action: "Проверьте цену и скидку до следующего запуска трафика."
      };
    }

    if (input.marginPct < 0.08) {
      return {
        status: "loss",
        statusLabel: "Убыточный SKU",
        requiresAttention: true,
        returnRate,
        reason: "Запас маржи исчез: скидка, комиссия или логистика съели unit-экономику.",
        action: "Не масштабируйте SKU без пересчёта цены и затрат."
      };
    }

    return {
      status: "loss",
      statusLabel: "Убыточный SKU",
      requiresAttention: true,
      returnRate,
      reason: "Расходы WB и закупка уже выше допустимого уровня для текущей цены.",
      action: "Проверьте цену, закупку и комиссии по SKU."
    };
  }

  if (input.hasIncompleteCosts) {
    if (returnRate >= 0.12) {
      return {
        status: "incomplete",
        statusLabel: "Неполная экономика",
        requiresAttention: true,
        returnRate,
        reason: "Прибыль может быть завышена: экономика неполная, а возвраты уже выглядят опасно.",
        action: "Заполните затраты и отдельно проверьте возвраты."
      };
    }

    return {
      status: "incomplete",
      statusLabel: "Неполная экономика",
      requiresAttention: true,
      returnRate,
      reason: "Прибыль может быть завышена: по SKU не хватает части ручных затрат.",
      action: "Заполните себестоимость, упаковку и обработку."
    };
  }

  if (returnRate >= 0.18) {
    return {
      status: "at_risk",
      statusLabel: "SKU под риском",
      requiresAttention: true,
      returnRate,
      reason: "Возвраты уже почти съедают запас по марже.",
      action: "Не масштабируйте SKU, пока не разберёте возвраты."
    };
  }

  if (returnRate >= 0.12) {
    return {
      status: "at_risk",
      statusLabel: "SKU под риском",
      requiresAttention: true,
      returnRate,
      reason: "Возвраты съедают слишком большую долю маржи.",
      action: "Проверьте возвраты и не усиливайте рекламу без пересчёта."
    };
  }

  if (input.marginPct < 0.08) {
    return {
      status: "at_risk",
      statusLabel: "SKU под риском",
      requiresAttention: true,
      returnRate,
      reason: "Маржа уже низкая: даже небольшая скидка уводит SKU в минус.",
      action: "Проверьте цену и не усиливайте рекламу без пересчёта."
    };
  }

  if (input.marginPct < 0.15) {
    return {
      status: "at_risk",
      statusLabel: "SKU под риском",
      requiresAttention: true,
      returnRate,
      reason: "Логистика и комиссии съедают безопасный запас маржи.",
      action: "Проверьте цену, логистику и не масштабируйте без пересчёта."
    };
  }

  return {
    status: "profitable",
    statusLabel: "Прибыльный SKU",
    requiresAttention: false,
    returnRate,
    reason:
      returnRate >= 0.08
        ? "SKU пока держит плюс, но возвраты уже стоит контролировать отдельно."
        : "SKU держит рабочую маржу и не требует срочного вмешательства.",
    action: returnRate >= 0.08 ? "Сохраняйте цену и отдельно наблюдайте за возвратами." : "Поддерживайте остатки и не давайте скидке съесть маржу."
  };
}
