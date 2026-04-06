import { prisma } from "@/server/lib/prisma";
import { toNumber } from "@/server/lib/number";
import { getWbConnection } from "@/server/modules/wb/service";
import { resolveOrganizationContext } from "@/server/modules/workspace/context";

export async function getOnboardingState(options?: { organizationId?: string }) {
  const organization = await resolveOrganizationContext(options);
  const [connection, latestSync, latestSnapshot, skuCount, costProfileCount, dailyMetricCount] = await Promise.all([
    getWbConnection(options),
    prisma.syncRun.findFirst({
      where: { organizationId: organization.id },
      orderBy: { startedAt: "desc" }
    }),
    prisma.cashSnapshot.findFirst({
      where: { organizationId: organization.id },
      orderBy: { snapshotDate: "desc" }
    }),
    prisma.sKU.count({
      where: { organizationId: organization.id }
    }),
    prisma.costProfile.count({
      where: { organizationId: organization.id }
    }),
    prisma.dailySkuMetric.count({
      where: { organizationId: organization.id }
    })
  ]);

  return {
    connection,
    latestSync,
    latestSnapshot: latestSnapshot
      ? {
          snapshotDate: latestSnapshot.snapshotDate,
          availableRub: toNumber(latestSnapshot.availableRub),
          notes: latestSnapshot.notes
        }
      : null,
    skuCount,
    costProfileCount,
    dailyMetricCount,
    steps: [
      {
        key: "wb_connection",
        title: "Подключить кабинет WB",
        description: "Подключите один кабинет WB, чтобы начать ежедневную загрузку данных.",
        isDone: connection?.status === "CONNECTED"
      },
      {
        key: "first_sync",
        title: "Загрузить товары и финансы",
        description: "Запустите первую синхронизацию, чтобы получить SKU, продажи, комиссии и выплаты.",
        isDone: dailyMetricCount > 0
      },
      {
        key: "cash_inputs",
        title: "Указать остаток денег",
        description: "Добавьте текущий денежный остаток, чтобы система считала кассовый разрыв.",
        isDone: Boolean(latestSnapshot)
      },
      {
        key: "sku_costs",
        title: "Задать себестоимость SKU",
        description: "Добавьте себестоимость и упаковку хотя бы для ключевых SKU, чтобы видеть чистую прибыль.",
        isDone: costProfileCount > 0
      }
    ]
  };
}
