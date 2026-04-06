type StatusTone = "default" | "success" | "warning" | "danger" | "info";

function getTone(value: string): StatusTone {
  const normalized = value.toLowerCase();
  if (["success"].includes(normalized)) {
    return "success";
  }

  if (["warning"].includes(normalized)) {
    return "warning";
  }

  if (["danger"].includes(normalized)) {
    return "danger";
  }

  if (["info"].includes(normalized)) {
    return "info";
  }

  if (["connected", "completed", "clear", "generated", "admin", "active"].includes(normalized)) {
    return "success";
  }

  if (["watch", "scheduled", "importing", "normalizing", "calculating", "generating_insights", "projecting_cash", "analyst"].includes(normalized)) {
    return "warning";
  }

  if (["failed", "error", "risk", "fallback", "archived"].includes(normalized)) {
    return "danger";
  }

  if (["manual", "placeholder"].includes(normalized)) {
    return "info";
  }

  if (["demo", "mock"].includes(normalized)) {
    return "info";
  }

  if (["live"].includes(normalized)) {
    return "success";
  }

  return "default";
}

function humanize(value: string) {
  const dictionary: Record<string, string> = {
    success: "Ок",
    warning: "Внимание",
    danger: "Риск",
    info: "Справка",
    connected: "Подключено",
    completed: "Готово",
    clear: "Низкий риск",
    generated: "Готово",
    admin: "Админ",
    active: "Активно",
    watch: "Под наблюдением",
    scheduled: "Нужно действие",
    importing: "Импорт",
    normalizing: "Нормализация",
    calculating: "Расчёт",
    generating_insights: "Инсайты",
    projecting_cash: "Прогноз кассы",
    analyst: "Аналитик",
    failed: "Ошибка",
    error: "Ошибка",
    risk: "Высокий риск",
    fallback: "Без ИИ",
    archived: "Архив",
    manual: "Вручную",
    placeholder: "Черновик",
    demo: "Демо",
    mock: "Демо",
    live: "Рабочий",
    tax: "Налог",
    payroll: "Зарплата",
    supplier: "Поставщик",
    operations: "Операционные",
    other: "Другое",
    daily_brief: "Бриф",
    sku_explanation: "SKU",
    cash_gap: "Касса"
  };
  const normalized = value.toLowerCase();

  if (dictionary[normalized]) {
    return dictionary[normalized];
  }

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (symbol) => symbol.toUpperCase());
}

export function StatusBadge({ value, label, className }: { value: string; label?: string; className?: string }) {
  const tone = getTone(value);
  const content = label ?? humanize(value);
  const isNumeric = /^\d+$/.test(content);

  return <span className={`status-badge status-badge--${tone}${isNumeric ? " status-badge--numeric" : ""}${className ? ` ${className}` : ""}`}>{content}</span>;
}
