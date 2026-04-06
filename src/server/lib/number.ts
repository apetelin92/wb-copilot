import { Prisma } from "@prisma/client";

export function toDecimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

export function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  return Number(value.toString());
}

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
