export type WbCredentials = {
  name: string;
  apiToken: string;
  cabinetId?: string;
};

export type WbProduct = {
  externalId: string;
  nmId: string;
  vendorCode?: string;
  title: string;
  brand?: string;
  subject?: string;
};

export type WbSaleRecord = {
  externalId: string;
  nmId: string;
  recordDate: Date;
  soldUnits: number;
  returnedUnits: number;
  grossRevenueRub: number;
  discountRub: number;
  refundRub: number;
};

export type WbFeeRecord = {
  externalId: string;
  nmId: string;
  recordDate: Date;
  commissionRub: number;
  logisticsRub: number;
  storageRub: number;
  penaltyRub: number;
  returnCostRub: number;
};

export type WbPayoutRecord = {
  externalId: string;
  payoutDate: Date;
  amountRub: number;
};

export type WbSyncPayload = {
  products: WbProduct[];
  sales: WbSaleRecord[];
  fees: WbFeeRecord[];
  payouts: WbPayoutRecord[];
};

export type WbSyncParams = {
  fromDate: Date;
  toDate: Date;
};

export interface WbAdapter {
  verifyConnection(credentials: WbCredentials): Promise<{ accountName: string; cabinetId?: string }>;
  fetchDailySnapshot(credentials: WbCredentials, params: WbSyncParams): Promise<WbSyncPayload>;
}
