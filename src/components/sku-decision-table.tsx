"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { SkuListFilter } from "@/server/modules/sku/service";

type SkuDecisionRow = {
  skuId: string;
  title: string;
  vendorCode?: string | null;
  wbNmId: string;
  netRevenueRub: number;
  contributionProfitRub: number;
  marginPct: number;
  healthStatus: string;
  healthLabel: string;
  primaryReason: string;
  recommendedAction: string;
};

function getBadgeValue(status: string) {
  if (status === "loss") {
    return "danger";
  }

  if (status === "incomplete" || status === "at_risk") {
    return "warning";
  }

  return "success";
}

function getPrimarySliceBadge(filter: SkuListFilter, sku: SkuDecisionRow) {
  if (filter === "loss") {
    return { label: "Убыточные", value: "danger" };
  }

  if (filter === "incomplete") {
    return { label: "Неполные затраты", value: "warning" };
  }

  if (filter === "at_risk") {
    return { label: "Под риском", value: "warning" };
  }

  if (filter === "positive") {
    return { label: "Прибыльные", value: "success" };
  }

  return { label: sku.healthLabel, value: getBadgeValue(sku.healthStatus) };
}

export function SkuDecisionTable({ items, activeFilter = "all" }: { items: SkuDecisionRow[]; activeFilter?: SkuListFilter }) {
  const router = useRouter();

  return (
    <table className="table table--attention">
      <thead>
        <tr>
          <th>SKU</th>
          <th>Статус</th>
          <th>Причина</th>
          <th>Что сделать</th>
          <th>Прибыль</th>
          <th>Маржа</th>
        </tr>
      </thead>
      <tbody>
        {items.map((sku) => {
          const primaryBadge = getPrimarySliceBadge(activeFilter, sku);

          return (
            <tr
              className={`table-row--${sku.healthStatus} table-row--clickable`}
              key={sku.skuId}
              onClick={() => router.push(`/skus/${sku.skuId}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  router.push(`/skus/${sku.skuId}`);
                }
              }}
              role="link"
              tabIndex={0}
            >
              <td className="table-cell--sku">
                <Link className="table-sku-link" href={`/skus/${sku.skuId}`} onClick={(event) => event.stopPropagation()}>
                  <span className="table-sku-link__title">{sku.title}</span>
                  <span className="table-sku-link__meta">
                    {sku.vendorCode ?? "Без vendor code"} · WB {sku.wbNmId} · Выручка {formatCurrency(sku.netRevenueRub)}
                  </span>
                </Link>
              </td>
              <td>
                <div className="status-stack">
                  <StatusBadge value={primaryBadge.value} label={primaryBadge.label} />
                  {activeFilter !== "all" && activeFilter !== "attention" && primaryBadge.label !== sku.healthLabel ? (
                    <span className="status-note">{sku.healthLabel}</span>
                  ) : null}
                </div>
              </td>
              <td>{sku.primaryReason}</td>
              <td>{sku.recommendedAction}</td>
              <td className={sku.contributionProfitRub >= 0 ? "text-success" : "text-danger"}>{formatCurrency(sku.contributionProfitRub)}</td>
              <td>{formatPercent(sku.marginPct)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
