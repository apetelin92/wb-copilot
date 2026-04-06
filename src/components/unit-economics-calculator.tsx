"use client";

import { useEffect, useMemo, useState } from "react";

import { StatusSummaryBlock } from "@/components/status-summary-block";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { MARKETPLACE_PRESETS } from "@/lib/unit-economics/presets";
import { calculateUnitEconomics, validateUnitEconomicsInput } from "@/lib/unit-economics/calculator";
import { decodeUnitEconomicsDraft, encodeUnitEconomicsDraft } from "@/lib/unit-economics/share";
import type { MarketplacePreset, MonetaryMode, UnitEconomicsInput } from "@/lib/unit-economics/types";
import { formatCurrency, formatPercent } from "@/lib/format";

type CalculatorFormState = {
  skuName: string;
  marketplacePreset: MarketplacePreset;
  salePrice: string;
  costPrice: string;
  commissionMode: MonetaryMode;
  commissionValue: string;
  logisticsCost: string;
  storageCost: string;
  packagingCost: string;
  handlingCost: string;
  adsCost: string;
  returnsCost: string;
  otherCosts: string;
  taxMode: MonetaryMode;
  taxValue: string;
  discountMode: MonetaryMode;
  discountValue: string;
};

type WhatIfState = {
  salePriceDelta: number;
  adsCostDelta: number;
  costPriceDelta: number;
};

type SectionField = {
  key:
    | "skuName"
    | "salePrice"
    | "costPrice"
    | "commissionValue"
    | "logisticsCost"
    | "storageCost"
    | "packagingCost"
    | "handlingCost"
    | "adsCost"
    | "returnsCost"
    | "otherCosts"
    | "taxValue"
    | "discountValue";
  label: string;
  placeholder: string;
  type: "text" | "number";
  hint?: string;
};

const DRAFT_STORAGE_KEY = "marginpoint-unit-economics-draft";

function numberToString(value: number) {
  return value === 0 ? "" : String(value);
}

function createFormStateFromPreset(preset: MarketplacePreset): CalculatorFormState {
  const defaults = MARKETPLACE_PRESETS[preset].defaults;

  return {
    skuName: defaults.skuName ?? "",
    marketplacePreset: preset,
    salePrice: String(defaults.salePrice),
    costPrice: String(defaults.costPrice),
    commissionMode: defaults.commissionMode,
    commissionValue: String(defaults.commissionValue),
    logisticsCost: String(defaults.logisticsCost),
    storageCost: numberToString(defaults.storageCost),
    packagingCost: String(defaults.packagingCost),
    handlingCost: String(defaults.handlingCost),
    adsCost: String(defaults.adsCost),
    returnsCost: String(defaults.returnsCost),
    otherCosts: numberToString(defaults.otherCosts),
    taxMode: defaults.taxMode,
    taxValue: String(defaults.taxValue),
    discountMode: defaults.discountMode,
    discountValue: numberToString(defaults.discountValue)
  };
}

function parseNumber(value: string) {
  if (!value.trim()) {
    return 0;
  }

  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasInvalidNumber(value: string) {
  if (!value.trim()) {
    return false;
  }

  return !Number.isFinite(Number(value.replace(",", ".")));
}

function toInput(state: CalculatorFormState): UnitEconomicsInput {
  return {
    skuName: state.skuName.trim() || undefined,
    marketplacePreset: state.marketplacePreset,
    salePrice: parseNumber(state.salePrice),
    costPrice: parseNumber(state.costPrice),
    commissionMode: state.commissionMode,
    commissionValue: parseNumber(state.commissionValue),
    logisticsCost: parseNumber(state.logisticsCost),
    storageCost: parseNumber(state.storageCost),
    packagingCost: parseNumber(state.packagingCost),
    handlingCost: parseNumber(state.handlingCost),
    adsCost: parseNumber(state.adsCost),
    returnsCost: parseNumber(state.returnsCost),
    otherCosts: parseNumber(state.otherCosts),
    taxMode: state.taxMode,
    taxValue: parseNumber(state.taxValue),
    discountMode: state.discountMode,
    discountValue: parseNumber(state.discountValue)
  };
}

function getFieldErrors(state: CalculatorFormState) {
  const parsed = toInput(state);
  const validation = validateUnitEconomicsInput(parsed);

  const numericFields: Array<keyof CalculatorFormState> = [
    "salePrice",
    "costPrice",
    "commissionValue",
    "logisticsCost",
    "storageCost",
    "packagingCost",
    "handlingCost",
    "adsCost",
    "returnsCost",
    "otherCosts",
    "taxValue",
    "discountValue"
  ];

  numericFields.forEach((field) => {
    if (hasInvalidNumber(state[field] as string)) {
      validation[field as keyof UnitEconomicsInput] = "Введите число в формате 123 или 123,45.";
    }
  });

  return validation;
}

function createFormStateFromInput(input: UnitEconomicsInput): CalculatorFormState {
  return {
    skuName: input.skuName ?? "",
    marketplacePreset: input.marketplacePreset,
    salePrice: numberToString(input.salePrice),
    costPrice: numberToString(input.costPrice),
    commissionMode: input.commissionMode,
    commissionValue: numberToString(input.commissionValue),
    logisticsCost: numberToString(input.logisticsCost),
    storageCost: numberToString(input.storageCost),
    packagingCost: numberToString(input.packagingCost),
    handlingCost: numberToString(input.handlingCost),
    adsCost: numberToString(input.adsCost),
    returnsCost: numberToString(input.returnsCost),
    otherCosts: numberToString(input.otherCosts),
    taxMode: input.taxMode,
    taxValue: numberToString(input.taxValue),
    discountMode: input.discountMode,
    discountValue: numberToString(input.discountValue)
  };
}

function getTone(status: string) {
  if (status === "loss_making") {
    return "danger" as const;
  }

  if (status === "at_risk") {
    return "warning" as const;
  }

  return "success" as const;
}

function buildDecisionSummary(input: {
  status: string;
  contributionProfit: number;
  breakEvenPrice: number | null;
  maxAdSpend: number;
  maxCostPrice: number;
  topDrivers: string[];
}) {
  const breakEvenText = input.breakEvenPrice ? formatCurrency(input.breakEvenPrice) : "не считается";
  const driversText = input.topDrivers.length > 0 ? input.topDrivers.join(", ") : "несколько статей расходов";

  if (input.status === "loss_making") {
    return {
      conclusion: `SKU теряет ${formatCurrency(Math.abs(input.contributionProfit))} на единице.`,
      mainRisk: `${driversText} уже съедают экономику. Точка безубыточности по цене — ${breakEvenText}.`,
      whatToDo: `Поднимите цену выше ${breakEvenText} или снижайте себестоимость ниже ${formatCurrency(input.maxCostPrice)} и рекламу. Без этого SKU остаётся в минусе.`
    };
  }

  if (input.status === "at_risk") {
    return {
      conclusion: `SKU ещё в плюсе, но запас слишком тонкий: ${formatCurrency(input.contributionProfit)} на единице.`,
      mainRisk: `${driversText} быстро съедят маржу. Реклама выше ${formatCurrency(input.maxAdSpend)} уже опасна.`,
      whatToDo: `Не усиливайте трафик и держите цену выше ${breakEvenText}. Сначала стабилизируйте расходы.`
    };
  }

  return {
    conclusion: `SKU даёт ${formatCurrency(input.contributionProfit)} на единице и держит рабочую маржу.`,
    mainRisk: `${driversText} остаются главными статьями расхода. Цена ниже ${breakEvenText} уже сломает экономику.`,
    whatToDo: `Держите цену выше ${breakEvenText} и не поднимайте рекламу выше ${formatCurrency(input.maxAdSpend)} без пересчёта.`
  };
}

export function UnitEconomicsCalculator() {
  const [formState, setFormState] = useState<CalculatorFormState>(() => createFormStateFromPreset("wildberries"));
  const [whatIf, setWhatIf] = useState<WhatIfState>({ salePriceDelta: 0, adsCostDelta: 0, costPriceDelta: 0 });
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const draftParam = url.searchParams.get("draft");
    const decoded = draftParam ? decodeUnitEconomicsDraft(draftParam) : null;

    if (decoded) {
      setFormState(createFormStateFromInput(decoded));
      return;
    }

    const savedDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (savedDraft) {
      const parsed = decodeUnitEconomicsDraft(savedDraft);
      if (parsed) {
        setFormState(createFormStateFromInput(parsed));
      }
    }
  }, []);

  const parsedInput = useMemo(() => toInput(formState), [formState]);
  const fieldErrors = useMemo(() => getFieldErrors(formState), [formState]);
  const result = useMemo(() => calculateUnitEconomics(parsedInput), [parsedInput]);
  const presetCopy = MARKETPLACE_PRESETS[formState.marketplacePreset].copy;
  const simulatedResult = useMemo(
    () =>
      calculateUnitEconomics({
        ...parsedInput,
        salePrice: Math.max(parsedInput.salePrice + whatIf.salePriceDelta, 0),
        adsCost: Math.max(parsedInput.adsCost + whatIf.adsCostDelta, 0),
        costPrice: Math.max(parsedInput.costPrice + whatIf.costPriceDelta, 0)
      }),
    [parsedInput, whatIf]
  );

  function updateField<Key extends keyof CalculatorFormState>(key: Key, value: CalculatorFormState[Key]) {
    setFormState((current) => ({ ...current, [key]: value }));
  }

  function applyPreset(preset: MarketplacePreset) {
    setFormState((current) => ({
      ...createFormStateFromPreset(preset),
      skuName: current.skuName
    }));
    setWhatIf({ salePriceDelta: 0, adsCostDelta: 0, costPriceDelta: 0 });
  }

  async function copyLink() {
    const url = new URL(window.location.href);
    url.searchParams.set("draft", encodeUnitEconomicsDraft(parsedInput));
    await navigator.clipboard.writeText(url.toString());
    setShareMessage("Ссылка скопирована. Её можно отправить или открыть позже.");
    window.setTimeout(() => setShareMessage(null), 2500);
  }

  function saveDraft() {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, encodeUnitEconomicsDraft(parsedInput));
    setDraftMessage("Черновик сохранён в браузере.");
    window.setTimeout(() => setDraftMessage(null), 2500);
  }

  function resetCalculator() {
    setFormState(createFormStateFromPreset(formState.marketplacePreset));
    setWhatIf({ salePriceDelta: 0, adsCostDelta: 0, costPriceDelta: 0 });
  }

  const tone = getTone(result.status);
  const topDrivers = result.breakdown.slice(0, 3);
  const decisionSummary = buildDecisionSummary({
    status: result.status,
    contributionProfit: result.contributionProfit,
    breakEvenPrice: result.breakEvenPrice,
    maxAdSpend: result.maxAdSpend,
    maxCostPrice: result.maxCostPrice,
    topDrivers: topDrivers.map((driver) => driver.label)
  });
  const sections: Array<{ title: string; description: string; fields: SectionField[] }> = [
    {
      title: "Доход",
      description: "Сначала задайте реальную цену продажи и скидку, чтобы понять чистую выручку на единицу.",
      fields: [
        {
          key: "skuName",
          label: "Название SKU",
          placeholder: "Например: Термокружка 450 мл",
          type: "text"
        },
        {
          key: "salePrice",
          label: "Цена продажи, ₽",
          placeholder: "1990",
          type: "number",
          hint: "Фактическая цена продажи до вычета расходов."
        },
        {
          key: "discountValue",
          label: "Скидка / участие в акции",
          placeholder: formState.discountMode === "percent" ? "10" : "150",
          type: "number",
          hint: "Можно указать процент или сумму на единицу."
        }
      ]
    },
    {
      title: "Переменные расходы",
      description: "Это основные расходы, которые чаще всего съедают вклад в прибыль на единицу.",
      fields: [
        {
          key: "costPrice",
          label: "Себестоимость, ₽",
          placeholder: "780",
          type: "number"
        },
        {
          key: "commissionValue",
          label: presetCopy.commissionLabel,
          placeholder: formState.commissionMode === "percent" ? "19" : "320",
          type: "number",
          hint: presetCopy.commissionHint
        },
        {
          key: "logisticsCost",
          label: "Логистика, ₽",
          placeholder: "85",
          type: "number"
        },
        {
          key: "storageCost",
          label: "Хранение, ₽",
          placeholder: "8",
          type: "number"
        },
        {
          key: "packagingCost",
          label: "Упаковка, ₽",
          placeholder: "25",
          type: "number"
        },
        {
          key: "handlingCost",
          label: "Обработка / операционные на единицу, ₽",
          placeholder: "18",
          type: "number"
        }
      ]
    },
    {
      title: "Дополнительные расходы",
      description: "Оставьте ноль, если расхода нет. Но лучше указать реальные значения, иначе маржа будет выглядеть лучше, чем есть.",
      fields: [
        {
          key: "adsCost",
          label: "Реклама на единицу, ₽",
          placeholder: "150",
          type: "number"
        },
        {
          key: "returnsCost",
          label: presetCopy.returnsLabel,
          placeholder: "40",
          type: "number"
        },
        {
          key: "otherCosts",
          label: "Прочие расходы на единицу, ₽",
          placeholder: "10",
          type: "number"
        },
        {
          key: "taxValue",
          label: "Налог / налоговая нагрузка",
          placeholder: formState.taxMode === "percent" ? "6" : "120",
          type: "number",
          hint: "Поддерживается простой базовый вариант: процент от выручки или фиксированная сумма."
        }
      ]
    }
  ] as const;

  return (
    <div className="calculator-layout">
      <section className="calculator-sidebar">
        <article className="panel panel--calm calculator-panel">
          <div className="meta-row">
            <div>
              <h2>Режим расчёта</h2>
              <p className="muted">{presetCopy.description}</p>
            </div>
            <StatusBadge value="info" label="Быстрый расчёт" />
          </div>
          <div className="pill-row">
            {(Object.keys(MARKETPLACE_PRESETS) as MarketplacePreset[]).map((preset) => (
              <button
                className={`pill pill--button ${formState.marketplacePreset === preset ? "pill--active" : ""}`}
                key={preset}
                onClick={() => applyPreset(preset)}
                type="button"
              >
                {MARKETPLACE_PRESETS[preset].copy.label}
              </button>
            ))}
          </div>
        </article>

        {sections.map((section) => (
          <article className="form-card calculator-panel" key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
            <div className="form-grid">
              {section.fields.map((field) => {
                const hasDanger = result.dangerousFieldKeys.includes(field.key as keyof UnitEconomicsInput);
                const error = fieldErrors[field.key as keyof UnitEconomicsInput];
                const isNumericField = field.type === "number";

                return (
                  <div className={`field ${field.key === "skuName" ? "field--full" : ""} ${hasDanger ? "field--danger" : ""}`} key={field.key}>
                    <label htmlFor={field.key}>{field.label}</label>
                    {field.key === "commissionValue" || field.key === "taxValue" || field.key === "discountValue" ? (
                      <div className="compound-input">
                        <input
                          id={field.key}
                          inputMode="decimal"
                          name={field.key}
                          onChange={(event) => updateField(field.key, event.target.value)}
                          placeholder={field.placeholder}
                          type="text"
                          value={formState[field.key]}
                        />
                        <select
                          aria-label={`${field.label} в процентах или рублях`}
                          onChange={(event) =>
                            updateField(
                              field.key === "commissionValue" ? "commissionMode" : field.key === "taxValue" ? "taxMode" : "discountMode",
                              event.target.value as MonetaryMode
                            )
                          }
                          value={
                            field.key === "commissionValue"
                              ? formState.commissionMode
                              : field.key === "taxValue"
                                ? formState.taxMode
                                : formState.discountMode
                          }
                        >
                          <option value="percent">%</option>
                          <option value="amount">₽</option>
                        </select>
                      </div>
                    ) : (
                      <input
                        id={field.key}
                        inputMode={isNumericField ? "decimal" : undefined}
                        name={field.key}
                        onChange={(event) => updateField(field.key, event.target.value)}
                        placeholder={field.placeholder}
                        type={field.type}
                        value={formState[field.key]}
                      />
                    )}
                    {error ? <span className="field__error">{error}</span> : null}
                    {field.hint ? <span className="field__hint">{field.hint}</span> : null}
                  </div>
                );
              })}
            </div>
          </article>
        ))}

        <details className="panel panel--muted calculator-panel details-card">
          <summary className="details-card__summary">
            <div>
              <strong>Черновик и ссылка</strong>
              <p className="muted">Служебный блок для сохранения и шаринга расчёта.</p>
            </div>
            <StatusBadge value="info" label="Вторично" />
          </summary>
          <div className="button-row">
            <button className="button button--secondary" onClick={saveDraft} type="button">
              Сохранить черновик
            </button>
            <button className="button button--ghost" onClick={copyLink} type="button">
              Скопировать ссылку
            </button>
            <button className="button button--ghost" onClick={resetCalculator} type="button">
              Сбросить
            </button>
          </div>
          {draftMessage ? <p className="form-help">{draftMessage}</p> : null}
          {shareMessage ? <p className="form-help">{shareMessage}</p> : null}
        </details>
      </section>

      <section className="calculator-main">
        <StatusSummaryBlock
          action={decisionSummary.whatToDo}
          actionLabel="Что делать"
          badgeLabel={result.statusLabel}
          meta={[
            { label: "Выручка на единицу", value: formatCurrency(result.revenuePerUnit) },
            { label: "Полные расходы", value: formatCurrency(result.totalCostPerUnit) },
            { label: "Опасная цена", value: result.breakEvenPrice ? formatCurrency(result.breakEvenPrice) : "Не считается" }
          ]}
          reason={decisionSummary.mainRisk}
          reasonLabel="Главный риск"
          title={decisionSummary.conclusion}
          tone={tone}
        />

        <section className="stats-grid calculator-results-grid">
          <StatCard label="Вклад в прибыль" tone={tone === "danger" ? "danger" : tone === "warning" ? "warning" : "success"} value={formatCurrency(result.contributionProfit)} hint="Сколько остаётся на единице после всех расходов" />
          <StatCard label="Маржа" tone={tone === "danger" ? "danger" : tone === "warning" ? "warning" : "success"} value={formatPercent(result.marginPercent / 100)} hint="Главный индикатор запаса прочности" />
          <StatCard label="Точка безубыточности по цене" value={result.breakEvenPrice ? formatCurrency(result.breakEvenPrice) : "Не считается"} hint="Цена ниже этого уровня делает SKU убыточным" />
        </section>

        <article className="panel calculator-panel panel--calm section-stack">
          <div className="meta-row">
            <div>
              <h2>Пороги риска</h2>
              <p className="muted">Вторичные лимиты для рекламы, себестоимости и скидки.</p>
            </div>
            <StatusBadge value="info" label="Вторично" />
          </div>
          <section className="stats-grid calculator-what-if-grid">
          <StatCard label="Макс. реклама" value={formatCurrency(result.maxAdSpend)} hint="Реклама выше этого уровня уже съедает прибыль" />
          <StatCard label="Опасная себестоимость" value={formatCurrency(result.maxCostPrice)} hint="Если COGS поднимется выше, SKU уйдёт в минус" />
          <StatCard label="Эффект скидки" value={formatCurrency(result.discountAmount)} hint="Сколько уже теряется на цене из-за скидки" />
          </section>
        </article>

        <article className="panel calculator-panel panel--calm">
          <div className="meta-row">
            <div>
              <h2>Куда уходят деньги</h2>
              <p className="muted">Сначала смотрите на самые тяжёлые статьи: они обычно сильнее всего съедают маржу.</p>
            </div>
            <StatusBadge value="info" label="Разбивка расходов" />
          </div>
          <div className="calculator-breakdown">
            {result.breakdown.map((item) => (
              <div className="calculator-breakdown__row" key={item.key}>
                <div className="calculator-breakdown__meta">
                  <strong>{item.label}</strong>
                  <span>
                    {formatCurrency(item.value)} · {item.shareOfRevenuePct.toFixed(1)}% выручки
                  </span>
                </div>
                <div className="calculator-breakdown__bar">
                  <div
                    className={`calculator-breakdown__fill ${item.isPrimaryDriver ? "calculator-breakdown__fill--primary" : ""}`}
                    style={{ width: `${Math.min(item.shareOfRevenuePct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel calculator-panel panel--calm">
          <div className="meta-row">
            <div>
              <h2>Быстрые сценарии</h2>
              <p className="muted">Проверьте, насколько опасны изменение цены, рекламы и себестоимости.</p>
            </div>
            <StatusBadge value="info" label="Что будет, если" />
          </div>
          <div className="calculator-scenarios">
            <div className="calculator-scenario-control">
              <span>Изменить цену продажи</span>
              <div className="button-row">
                <button className="button button--ghost" onClick={() => setWhatIf((current) => ({ ...current, salePriceDelta: current.salePriceDelta - 100 }))} type="button">
                  −100 ₽
                </button>
                <strong>{whatIf.salePriceDelta >= 0 ? `+${whatIf.salePriceDelta}` : whatIf.salePriceDelta} ₽</strong>
                <button className="button button--ghost" onClick={() => setWhatIf((current) => ({ ...current, salePriceDelta: current.salePriceDelta + 100 }))} type="button">
                  +100 ₽
                </button>
              </div>
            </div>
            <div className="calculator-scenario-control">
              <span>Изменить рекламу</span>
              <div className="button-row">
                <button className="button button--ghost" onClick={() => setWhatIf((current) => ({ ...current, adsCostDelta: current.adsCostDelta - 50 }))} type="button">
                  −50 ₽
                </button>
                <strong>{whatIf.adsCostDelta >= 0 ? `+${whatIf.adsCostDelta}` : whatIf.adsCostDelta} ₽</strong>
                <button className="button button--ghost" onClick={() => setWhatIf((current) => ({ ...current, adsCostDelta: current.adsCostDelta + 50 }))} type="button">
                  +50 ₽
                </button>
              </div>
            </div>
            <div className="calculator-scenario-control">
              <span>Изменить себестоимость</span>
              <div className="button-row">
                <button className="button button--ghost" onClick={() => setWhatIf((current) => ({ ...current, costPriceDelta: current.costPriceDelta - 50 }))} type="button">
                  −50 ₽
                </button>
                <strong>{whatIf.costPriceDelta >= 0 ? `+${whatIf.costPriceDelta}` : whatIf.costPriceDelta} ₽</strong>
                <button className="button button--ghost" onClick={() => setWhatIf((current) => ({ ...current, costPriceDelta: current.costPriceDelta + 50 }))} type="button">
                  +50 ₽
                </button>
              </div>
            </div>
          </div>
          <div className="stats-grid calculator-what-if-grid">
            <StatCard label="Новая прибыль" tone={getTone(simulatedResult.status) === "danger" ? "danger" : getTone(simulatedResult.status) === "warning" ? "warning" : "success"} value={formatCurrency(simulatedResult.contributionProfit)} hint="После всех выбранных изменений" />
            <StatCard label="Новая маржа" value={formatPercent(simulatedResult.marginPercent / 100)} hint="Показывает, стал ли SKU опасным" />
            <StatCard label="Новый статус" tone={getTone(simulatedResult.status) === "danger" ? "danger" : getTone(simulatedResult.status) === "warning" ? "warning" : "success"} value={simulatedResult.statusLabel} hint="Быстрое решение без ручного пересчёта" />
          </div>
        </article>
      </section>
    </div>
  );
}
