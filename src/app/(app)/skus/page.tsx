import Link from "next/link";

import { importCostProfilesFileAction, runSyncAction } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SkuDecisionTable } from "@/components/sku-decision-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { listIncompleteEconomicsQueue, listSkuProfitability, type SkuListFilter } from "@/server/modules/sku/service";

export const dynamic = "force-dynamic";

const filters: Array<{ value: SkuListFilter; label: string }> = [
  { value: "attention", label: "Требуют внимания" },
  { value: "loss", label: "Убыточные" },
  { value: "incomplete", label: "Неполная экономика" },
  { value: "at_risk", label: "Под риском" },
  { value: "positive", label: "Прибыльные" },
  { value: "all", label: "Все" }
];

const filterSet = new Set<SkuListFilter>(filters.map((filter) => filter.value));

const filterMeta: Record<SkuListFilter, { title: string; description: string }> = {
  attention: {
    title: "Требуют внимания",
    description: "Главный список на сегодня: сначала убыточные SKU, затем неполная экономика и низкая маржа."
  },
  loss: {
    title: "Убыточные",
    description: "SKU, которые уже тянут вклад в прибыль вниз."
  },
  incomplete: {
    title: "Неполная экономика",
    description: "По этим SKU прибыль может быть завышена, пока не подтверждена себестоимость."
  },
  at_risk: {
    title: "Под риском",
    description: "SKU ещё не ушли в минус, но маржа уже слишком низкая."
  },
  positive: {
    title: "Прибыльные",
    description: "Стабильные SKU без срочного вмешательства."
  },
  all: {
    title: "Все SKU",
    description: "Полный список SKU с причиной, действием и текущей прибылью."
  }
};

function resolveProfitabilityFilter(value?: string | string[]): SkuListFilter {
  const candidate = Array.isArray(value) ? value[0] : value;

  return candidate && filterSet.has(candidate as SkuListFilter) ? (candidate as SkuListFilter) : "attention";
}

function resolveLimit(value?: string | string[]) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = Number(candidate);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 12;
  }

  return Math.min(parsed, 200);
}

function buildSkuHref(profitability: SkuListFilter, limit?: number) {
  const params = new URLSearchParams({ profitability });

  if (limit) {
    params.set("limit", String(limit));
  }

  return `/skus?${params.toString()}`;
}

export default async function SkuListPage({
  searchParams
}: {
  searchParams?: { profitability?: string | string[]; limit?: string | string[]; costImportSuccess?: string; costImportError?: string };
}) {
  const profitability = resolveProfitabilityFilter(searchParams?.profitability);
  const visibleLimit = resolveLimit(searchParams?.limit);
  const [{ items, summary }, incompleteQueue] = await Promise.all([listSkuProfitability({ profitability }), listIncompleteEconomicsQueue()]);
  const costImportSuccess = searchParams?.costImportSuccess ? decodeURIComponent(Array.isArray(searchParams.costImportSuccess) ? searchParams.costImportSuccess[0] : searchParams.costImportSuccess) : null;
  const costImportError = searchParams?.costImportError ? decodeURIComponent(Array.isArray(searchParams.costImportError) ? searchParams.costImportError[0] : searchParams.costImportError) : null;
  const currentFilter = filterMeta[profitability];
  const visibleItems = items.slice(0, visibleLimit);
  const hasMore = items.length > visibleItems.length;
  const remainingCount = items.length - visibleItems.length;
  const currentDescription =
    profitability === "attention"
      ? `${summary.lossCount} убыточных, ${summary.incompleteCount} с неполной экономикой и ${summary.atRiskCount} под риском.`
      : currentFilter.description;

  const summaryCards: Array<{
    value: SkuListFilter;
    label: string;
    count: number;
    tone: "default" | "warning" | "success" | "danger";
    hint: string;
  }> = [
    {
      value: "attention",
      label: "Требуют внимания",
      count: summary.attentionCount,
      tone: summary.attentionCount > 0 ? "warning" : "success",
      hint: `${summary.lossCount} убыточных · ${summary.incompleteCount} неполных · ${summary.atRiskCount} под риском`
    },
    {
      value: "loss",
      label: "Убыточные",
      count: summary.lossCount,
      tone: summary.lossCount > 0 ? "danger" : "success",
      hint: "Уже теряют деньги"
    },
    {
      value: "incomplete",
      label: "Неполная экономика",
      count: summary.incompleteCount,
      tone: summary.incompleteCount > 0 ? "warning" : "success",
      hint: "Прибыль может быть завышена"
    },
    {
      value: "at_risk",
      label: "Под риском",
      count: summary.atRiskCount,
      tone: summary.atRiskCount > 0 ? "warning" : "success",
      hint: "Маржа уже слишком низкая"
    },
    {
      value: "positive",
      label: "Прибыльные",
      count: summary.profitableCount,
      tone: "success",
      hint: "Можно вести без срочного вмешательства"
    },
    {
      value: "all",
      label: "Все",
      count: summary.allCount,
      tone: "default",
      hint: "Полный список SKU"
    }
  ];

  return (
    <main className="page">
      <PageHeader
        eyebrow="SKU"
        badges={
          <>
            <StatusBadge label={currentFilter.title} value={profitability === "loss" ? "danger" : profitability === "positive" ? "success" : "warning"} />
            <StatusBadge label={`Показано ${visibleItems.length} из ${items.length}`} value="info" />
          </>
        }
        meta={
          <>
            <span className="meta-chip">Под вниманием: {summary.attentionCount}</span>
            <span className="meta-chip">Убыточные: {summary.lossCount}</span>
            <span className="meta-chip">Неполная экономика: {summary.incompleteCount}</span>
          </>
        }
        title="SKU"
        description="Главная рабочая поверхность: выберите срез, откройте SKU и примите решение." 
        actions={
          <div className="button-row">
            <Link className="button button--ghost" href={buildSkuHref("attention")}>
              Открыть рабочий список
            </Link>
            <form action={runSyncAction}>
              <SubmitButton pendingText="Синхронизируем..." variant="secondary">
                Обновить данные
              </SubmitButton>
            </form>
          </div>
        }
      />

      {costImportSuccess ? (
        <section className="alert alert--success">
          <strong>Затраты загружены.</strong>
          <p>{costImportSuccess}</p>
        </section>
      ) : null}
      {costImportError ? (
        <section className="alert alert--danger">
          <strong>Не удалось загрузить файл затрат.</strong>
          <p>{costImportError}</p>
        </section>
      ) : null}

      <section className="summary-card-grid">
        {summaryCards.map((card) => (
          <StatCard
            footer="Открыть список"
            hint={card.hint}
            href={buildSkuHref(card.value)}
            isActive={profitability === card.value}
            key={card.value}
            label={card.label}
            tone={card.tone}
            value={String(card.count)}
          />
        ))}
      </section>

      {profitability === "attention" && incompleteQueue.length > 0 ? (
        <section className="alert alert--warning">
          <strong>Неполная экономика у {incompleteQueue.length} SKU.</strong>
          <p>Прибыль по ним может быть завышена. Сначала откройте список, массовую загрузку оставьте как служебную утилиту ниже.</p>
          <div className="button-row">
            <Link className="button button--ghost button--small" href={buildSkuHref("incomplete")}>
              Открыть неполные SKU
            </Link>
          </div>
        </section>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="В этом списке пока пусто"
          description={profitability === "attention" ? "Сейчас нет SKU, которые требуют срочного внимания. Можно проверить прибыльные позиции." : "После обновления данных или изменения затрат здесь появятся SKU по выбранному фильтру."}
          actionHref={profitability === "attention" ? buildSkuHref("positive") : "/dashboard"}
          actionLabel={profitability === "attention" ? "Открыть прибыльные SKU" : "Вернуться на Сегодня"}
        />
      ) : (
        <section className="table-card section-stack">
          <div className="meta-row table-card__header">
            <div>
              <h2>{currentFilter.title}</h2>
              <p className="muted">{currentDescription}</p>
            </div>
            <span className="muted">Показано {visibleItems.length} из {items.length} SKU</span>
          </div>
          <div className="table-scroll">
            <SkuDecisionTable activeFilter={profitability} items={visibleItems} />
          </div>
          {hasMore ? (
            <div className="button-row button-row--center">
              {remainingCount > 20 ? (
                <Link className="button button--ghost" href={buildSkuHref(profitability, visibleLimit + 20)}>
                  Показать ещё {Math.min(20, remainingCount)}
                </Link>
              ) : null}
              <Link className="button button--ghost" href={buildSkuHref(profitability, items.length)}>
                Показать все {items.length}
              </Link>
            </div>
          ) : null}
        </section>
      )}

      <details className="panel panel--calm section-stack details-card">
        <summary className="details-card__summary">
          <div>
            <strong>Массовое обновление затрат</strong>
            <p className="muted">Служебный блок для CSV. Не нужен для ежедневного разбора SKU по одному.</p>
          </div>
          <StatusBadge label="CSV" value="info" />
        </summary>
        <div className="cards-grid file-tools-grid">
          <article className="file-tool-card">
            <div className="file-tool-card__content">
              <strong>1. Скачать шаблон</strong>
              <p>Пустой CSV для заполнения затрат. Ключ — `wb_nm_id`.</p>
            </div>
            <div className="file-tool-card__actions">
              <Link className="button button--ghost" href="/api/exports/cost-profiles-template">
                Скачать шаблон CSV
              </Link>
            </div>
          </article>

          <article className="file-tool-card">
            <div className="file-tool-card__content">
              <strong>2. Выгрузить текущие затраты</strong>
              <p>Подходит для массовой корректировки и повторной загрузки.</p>
            </div>
            <div className="file-tool-card__actions">
              <Link className="button button--ghost" href="/api/exports/cost-profiles">
                Скачать текущие затраты
              </Link>
            </div>
          </article>

          <article className="file-tool-card">
            <div className="file-tool-card__content">
              <strong>3. Загрузить CSV</strong>
              <p>Пустые строки импорт пропустит автоматически.</p>
            </div>
            <form action={importCostProfilesFileAction} className="file-upload-form" encType="multipart/form-data">
              <div className="field field--full">
                <label htmlFor="costFile">CSV-файл затрат</label>
                <input accept=".csv,text/csv" id="costFile" name="file" type="file" />
              </div>
              <div className="field field--full">
                <SubmitButton pendingText="Загружаем...">Загрузить CSV</SubmitButton>
              </div>
            </form>
          </article>
        </div>
      </details>
    </main>
  );
}
