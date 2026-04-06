import { AppError } from "@/server/lib/errors";
import { addUtcDays, startOfUtcDay } from "@/server/lib/date";

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

type JsonRecord = Record<string, unknown>;

const STATISTICS_API_BASE_URL = "https://statistics-api.wildberries.ru";
const CONTENT_API_BASE_URL = "https://content-api.wildberries.ru";

type RequestOptions = {
  method?: "GET" | "POST";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  retries?: number;
};

type ContentCardsResponse = {
  cards?: JsonRecord[];
  cursor?: JsonRecord;
  data?: {
    cards?: JsonRecord[];
    cursor?: JsonRecord;
  };
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatWbDate(date: Date) {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = value.replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toInt(value: unknown, fallback = 0) {
  const parsed = Math.trunc(toNumber(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asDate(value: unknown, fallback?: Date) {
  if (!value) {
    if (fallback) {
      return fallback;
    }

    throw new AppError(500, "wb_invalid_date", "WB adapter returned an invalid date.");
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    if (fallback) {
      return fallback;
    }

    throw new AppError(500, "wb_invalid_date", `WB adapter returned an invalid date value: ${String(value)}`);
  }

  return parsed;
}

function normalizeTitle(card: JsonRecord, nmId: string) {
  const directTitle =
    (typeof card.title === "string" && card.title) ||
    (typeof card.subjectName === "string" && card.subjectName) ||
    (typeof card.object === "string" && card.object) ||
    (typeof card.vendorCode === "string" && card.vendorCode);

  return directTitle || `WB SKU ${nmId}`;
}

function createHeaders(token: string, hasJsonBody: boolean) {
  return {
    Authorization: token,
    ...(hasJsonBody ? { "Content-Type": "application/json" } : {})
  };
}

async function request<T>(baseUrl: string, path: string, token: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(path, baseUrl);
  Object.entries(options.query ?? {}).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  const retries = options.retries ?? 2;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url.toString(), {
        method: options.method ?? (options.body ? "POST" : "GET"),
        headers: createHeaders(token, Boolean(options.body)),
        body: options.body ? JSON.stringify(options.body) : undefined,
        cache: "no-store"
      });

      if (response.ok) {
        const text = await response.text();
        return (text ? JSON.parse(text) : []) as T;
      }

      const responseText = await response.text();
      const responseJson = responseText ? (JSON.parse(responseText) as JsonRecord) : undefined;
      const detail =
        (typeof responseJson?.detail === "string" && responseJson.detail) ||
        (typeof responseJson?.message === "string" && responseJson.message) ||
        `WB request failed for ${path}`;

      if ((response.status === 429 || response.status >= 500) && attempt < retries) {
        await sleep(500 * (attempt + 1));
        continue;
      }

      throw new AppError(response.status, "wb_request_failed", detail, {
        path,
        status: response.status,
        body: responseJson ?? responseText
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (attempt < retries) {
        await sleep(500 * (attempt + 1));
        continue;
      }

      throw new AppError(502, "wb_network_error", "Failed to reach Wildberries APIs.", {
        path,
        cause: error instanceof Error ? error.message : String(error)
      });
    }
  }

  throw new AppError(502, "wb_network_error", "WB request failed after retries.");
}

function getCardsFromResponse(payload: ContentCardsResponse) {
  return payload.cards ?? payload.data?.cards ?? [];
}

function getCursorFromResponse(payload: ContentCardsResponse) {
  return payload.cursor ?? payload.data?.cursor ?? {};
}

function mapContentCard(card: JsonRecord): WbProduct | null {
  const nmId = String(card.nmID ?? card.nmId ?? "").trim();
  if (!nmId) {
    return null;
  }

  return {
    externalId: `prod-${nmId}`,
    nmId,
    vendorCode: typeof card.vendorCode === "string" ? card.vendorCode : undefined,
    title: normalizeTitle(card, nmId),
    brand: typeof card.brand === "string" ? card.brand : undefined,
    subject: typeof card.subjectName === "string" ? card.subjectName : typeof card.object === "string" ? card.object : undefined
  };
}

function isReturnRow(row: JsonRecord) {
  const saleId = String(row.saleID ?? row.saleId ?? "");
  const operationName = String(row.supplier_oper_name ?? row.supplierOperName ?? row.doc_type_name ?? "").toLowerCase();

  return saleId.startsWith("R") || operationName.includes("возврат") || operationName.includes("return");
}

function mapSalesRows(rows: JsonRecord[]) {
  const grouped = new Map<string, WbSaleRecord>();

  for (const row of rows) {
    const nmId = String(row.nmId ?? row.nmID ?? row.nm_id ?? "").trim();
    if (!nmId) {
      continue;
    }

    const recordDate = startOfUtcDay(asDate(row.sale_dt ?? row.date ?? row.lastChangeDate));
    const key = `${nmId}:${recordDate.toISOString()}`;
    const quantity = Math.max(toInt(row.quantity, 1), 1);
    const baseUnitPrice = toNumber(row.finishedPrice ?? row.finished_price ?? row.totalPrice ?? row.total_price ?? row.retail_price);
    const discountUnitPrice = toNumber(
      row.priceWithDisc ?? row.priceWithDiscRub ?? row.price_with_disc ?? row.retail_price_withdisc_rub ?? row.forPay
    );
    const entry = grouped.get(key) ?? {
      externalId: `sale-${nmId}-${formatWbDate(recordDate)}`,
      nmId,
      recordDate,
      soldUnits: 0,
      returnedUnits: 0,
      grossRevenueRub: 0,
      discountRub: 0,
      refundRub: 0
    };

    if (isReturnRow(row)) {
      entry.returnedUnits += quantity;
      entry.refundRub += quantity * (discountUnitPrice || baseUnitPrice);
    } else {
      entry.soldUnits += quantity;
      entry.grossRevenueRub += quantity * baseUnitPrice;
      if (discountUnitPrice > 0 && baseUnitPrice > 0) {
        entry.discountRub += Math.max(quantity * (baseUnitPrice - discountUnitPrice), 0);
      }
    }

    grouped.set(key, entry);
  }

  return [...grouped.values()];
}

function mapReportRowsToFees(rows: JsonRecord[]) {
  const grouped = new Map<string, WbFeeRecord>();

  for (const row of rows) {
    const nmId = String(row.nm_id ?? row.nmId ?? row.nmID ?? "").trim();
    if (!nmId) {
      continue;
    }

    const recordDate = startOfUtcDay(asDate(row.sale_dt ?? row.rr_dt ?? row.create_dt ?? row.order_dt));
    const key = `${nmId}:${recordDate.toISOString()}`;
    const entry = grouped.get(key) ?? {
      externalId: `fee-${nmId}-${formatWbDate(recordDate)}`,
      nmId,
      recordDate,
      commissionRub: 0,
      logisticsRub: 0,
      storageRub: 0,
      penaltyRub: 0,
      returnCostRub: 0
    };

    entry.commissionRub +=
      toNumber(row.ppvz_sales_commission) + toNumber(row.ppvz_reward) + toNumber(row.acquiring_fee);
    entry.logisticsRub += toNumber(row.delivery_rub);
    entry.storageRub += toNumber(row.storage_fee);
    entry.penaltyRub +=
      toNumber(row.penalty) + toNumber(row.additional_payment) + toNumber(row.deduction) + toNumber(row.acceptance);
    entry.returnCostRub += toNumber(row.rebill_logistic_cost);

    grouped.set(key, entry);
  }

  return [...grouped.values()];
}

function mapReportRowsToPayouts(rows: JsonRecord[]) {
  const grouped = new Map<string, WbPayoutRecord>();

  for (const row of rows) {
    const saleDate = startOfUtcDay(asDate(row.sale_dt ?? row.rr_dt ?? row.create_dt));
    const payoutDate = addUtcDays(saleDate, 7);
    const payoutAmount = toNumber(row.ppvz_for_pay);
    if (payoutAmount <= 0) {
      continue;
    }

    const key = payoutDate.toISOString();
    const entry = grouped.get(key) ?? {
      externalId: `payout-${formatWbDate(payoutDate)}`,
      payoutDate,
      amountRub: 0
    };

    entry.amountRub += payoutAmount;
    grouped.set(key, entry);
  }

  return [...grouped.values()];
}

async function fetchContentCards(token: string) {
  const products: WbProduct[] = [];
  let cursor: JsonRecord | undefined;

  for (let page = 0; page < 20; page += 1) {
    const body = {
      settings: {
        sort: {
          ascending: false
        },
        filter: {
          withPhoto: -1
        },
        cursor: {
          limit: 100,
          ...(cursor?.updatedAt ? { updatedAt: cursor.updatedAt } : {}),
          ...(cursor?.nmID ? { nmID: cursor.nmID } : {}),
          ...(cursor?.nmId ? { nmID: cursor.nmId } : {})
        }
      }
    };

    let payload: ContentCardsResponse;
    try {
      payload = await request<ContentCardsResponse>(CONTENT_API_BASE_URL, "/content/v2/get/cards/list", token, {
        method: "POST",
        body
      });
    } catch (error) {
      payload = await request<ContentCardsResponse>(CONTENT_API_BASE_URL, "/content/v2/cards/cursor/list", token, {
        method: "POST",
        body
      });
    }

    const cards = getCardsFromResponse(payload);
    const mappedCards = cards.map(mapContentCard).filter((item): item is WbProduct => Boolean(item));
    products.push(...mappedCards);

    if (cards.length < 100) {
      break;
    }

    const nextCursor = getCursorFromResponse(payload);
    if (!nextCursor || Object.keys(nextCursor).length === 0) {
      break;
    }

    cursor = nextCursor;
  }

  const unique = new Map(products.map((item) => [item.nmId, item]));
  return [...unique.values()];
}

async function fetchSalesRows(token: string, params: WbSyncParams) {
  return request<JsonRecord[]>(STATISTICS_API_BASE_URL, "/api/v1/supplier/sales", token, {
    query: {
      dateFrom: formatWbDate(params.fromDate)
    }
  });
}

async function fetchReportRows(token: string, params: WbSyncParams) {
  return request<JsonRecord[]>(STATISTICS_API_BASE_URL, "/api/v5/supplier/reportDetailByPeriod", token, {
    query: {
      dateFrom: formatWbDate(params.fromDate),
      dateTo: formatWbDate(params.toDate),
      limit: 100000,
      rrdid: 0
    },
    retries: 3
  });
}

export class HttpWbAdapter implements WbAdapter {
  constructor(private readonly baseUrl?: string) {}

  async verifyConnection(credentials: WbCredentials) {
    if (this.baseUrl) {
      const payload = await request<JsonRecord>(this.baseUrl, "/verify", credentials.apiToken);

      return {
        accountName: String(payload.accountName ?? credentials.name ?? "WB Account"),
        cabinetId: payload.cabinetId ? String(payload.cabinetId) : credentials.cabinetId
      };
    }

    const [contentCheck, salesCheck] = await Promise.allSettled([
      fetchContentCards(credentials.apiToken),
      fetchSalesRows(credentials.apiToken, {
        fromDate: addUtcDays(new Date(), -7),
        toDate: new Date()
      })
    ]);

    const errors = [contentCheck, salesCheck]
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => (result.reason instanceof Error ? result.reason.message : String(result.reason)));

    if (errors.length > 0) {
      throw new AppError(400, "wb_connection_verification_failed", "Не удалось проверить доступ к API WB. Нужны права на контент и статистику.", {
        errors
      });
    }

    return {
      accountName: credentials.name || "WB кабинет",
      cabinetId: credentials.cabinetId
    };
  }

  async fetchDailySnapshot(credentials: WbCredentials, params: WbSyncParams): Promise<WbSyncPayload> {
    if (this.baseUrl) {
      const query = `?fromDate=${params.fromDate.toISOString()}&toDate=${params.toDate.toISOString()}`;
      const [products, sales, fees, payouts] = await Promise.all([
        request<WbProduct[]>(this.baseUrl, `/products${query}`, credentials.apiToken),
        request<(WbSaleRecord & JsonRecord)[]>(this.baseUrl, `/sales${query}`, credentials.apiToken),
        request<(WbFeeRecord & JsonRecord)[]>(this.baseUrl, `/fees${query}`, credentials.apiToken),
        request<(WbPayoutRecord & JsonRecord)[]>(this.baseUrl, `/payouts${query}`, credentials.apiToken)
      ]);

      return {
        products,
        sales: sales.map((item) => ({
          ...item,
          recordDate: asDate(item.recordDate)
        })),
        fees: fees.map((item) => ({
          ...item,
          recordDate: asDate(item.recordDate)
        })),
        payouts: payouts.map((item) => ({
          ...item,
          payoutDate: asDate(item.payoutDate)
        }))
      };
    }

    const [products, salesRows, reportRows] = await Promise.all([
      fetchContentCards(credentials.apiToken),
      fetchSalesRows(credentials.apiToken, params),
      fetchReportRows(credentials.apiToken, params)
    ]);

    return {
      products,
      sales: mapSalesRows(salesRows),
      fees: mapReportRowsToFees(reportRows),
      payouts: mapReportRowsToPayouts(reportRows)
    };
  }
}
