const rubFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0
});

const rubFormatterPrecise = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2
});

const percentFormatter = new Intl.NumberFormat("ru-RU", {
  style: "percent",
  maximumFractionDigits: 1
});

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit"
});

export function formatCurrency(value: number, precise = false) {
  return (precise ? rubFormatterPrecise : rubFormatter).format(value);
}

export function formatPercent(value: number) {
  return percentFormatter.format(value);
}

export function formatDate(value: Date | string) {
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: Date | string) {
  return dateTimeFormatter.format(new Date(value));
}

export function formatShortNumber(value: number) {
  return new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
