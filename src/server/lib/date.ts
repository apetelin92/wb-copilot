const MS_IN_DAY = 24 * 60 * 60 * 1000;

export function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addUtcDays(date: Date, days: number) {
  return new Date(startOfUtcDay(date).getTime() + days * MS_IN_DAY);
}

export function enumerateUtcDays(fromDate: Date, toDate: Date) {
  const days: Date[] = [];
  let current = startOfUtcDay(fromDate);
  const end = startOfUtcDay(toDate);

  while (current.getTime() <= end.getTime()) {
    days.push(current);
    current = addUtcDays(current, 1);
  }

  return days;
}

export function formatDateKey(date: Date) {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

export function parseDateInput(value: string | null | undefined, fallback: Date) {
  if (!value) {
    return startOfUtcDay(fallback);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }

  return startOfUtcDay(parsed);
}

export function dateFromDateKey(value: string) {
  return startOfUtcDay(new Date(`${value}T00:00:00.000Z`));
}
