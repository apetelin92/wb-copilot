export type DemoScenarioKey = "growth" | "decline" | "cash-risk";

export type DemoScenario = {
  key: DemoScenarioKey;
  label: string;
  description: string;
  connectionName: string;
  cabinetId: string;
  snapshotRub: number;
  commitments: Array<{
    title: string;
    commitmentType: "SUPPLIER" | "TAX" | "PAYROLL" | "OPERATIONS" | "OTHER";
    dueInDays: number;
    amountRub: number;
    notes: string;
  }>;
};

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    key: "growth",
    label: "Рост",
    description: "Сильные продажи, здоровая маржа и позитивная кассовая траектория.",
    connectionName: "Демо кабинет WB · Рост",
    cabinetId: "mock-growth",
    snapshotRub: 345000,
    commitments: [
      { title: "Закупка топовых SKU", commitmentType: "SUPPLIER", dueInDays: 4, amountRub: 165000, notes: "Поддержать ростовые позиции" },
      { title: "Налоговый платёж", commitmentType: "TAX", dueInDays: 9, amountRub: 78000, notes: "Плановый налоговый платёж" },
      { title: "Выплата команде", commitmentType: "PAYROLL", dueInDays: 12, amountRub: 71000, notes: "Фиксированная операционная выплата" },
      { title: "Реклама на бестселлеры", commitmentType: "OPERATIONS", dueInDays: 2, amountRub: 42000, notes: "Масштабирование наиболее маржинальных SKU" },
      { title: "Резерв под упаковку", commitmentType: "OTHER", dueInDays: 7, amountRub: 29000, notes: "Расширение склада под рост" }
    ]
  },
  {
    key: "decline",
    label: "Просадка",
    description: "Маржа падает, возвраты и скидки растут, часть SKU уходит в минус.",
    connectionName: "Демо кабинет WB · Просадка",
    cabinetId: "mock-decline",
    snapshotRub: 218000,
    commitments: [
      { title: "Закупка обязательного остатка", commitmentType: "SUPPLIER", dueInDays: 5, amountRub: 152000, notes: "Нельзя переносить из-за контракта" },
      { title: "Сервисные расходы", commitmentType: "OPERATIONS", dueInDays: 3, amountRub: 51000, notes: "Подписки и подрядчики" },
      { title: "Налоговый платёж", commitmentType: "TAX", dueInDays: 8, amountRub: 74000, notes: "Плановый платёж" },
      { title: "Резерв на возвраты", commitmentType: "OTHER", dueInDays: 6, amountRub: 36000, notes: "Под повышенный уровень возвратов" },
      { title: "Выплата команде", commitmentType: "PAYROLL", dueInDays: 13, amountRub: 68000, notes: "Фиксированные выплаты" }
    ]
  },
  {
    key: "cash-risk",
    label: "Кассовый риск",
    description: "Продажи ещё есть, но выплаты WB и обязательства создают риск ухода в минус по кассе.",
    connectionName: "Демо кабинет WB · Кассовый риск",
    cabinetId: "mock-cash-risk",
    snapshotRub: 126000,
    commitments: [
      { title: "Крупная поставка под сезон", commitmentType: "SUPPLIER", dueInDays: 3, amountRub: 198000, notes: "Предоплата поставщику" },
      { title: "Налоговый платёж", commitmentType: "TAX", dueInDays: 7, amountRub: 82000, notes: "Платёж по графику" },
      { title: "Зарплата", commitmentType: "PAYROLL", dueInDays: 10, amountRub: 71000, notes: "Фиксированные выплаты" },
      { title: "Маркетинг", commitmentType: "OPERATIONS", dueInDays: 2, amountRub: 47000, notes: "Уже подтверждённый рекламный бюджет" },
      { title: "Возврат аванса контрагенту", commitmentType: "OTHER", dueInDays: 6, amountRub: 39000, notes: "Разовая корректировка" },
      { title: "Ускоренная логистика", commitmentType: "OPERATIONS", dueInDays: 5, amountRub: 33000, notes: "Покрытие срочной поставки" }
    ]
  }
];

export const DEFAULT_DEMO_SCENARIO_KEY: DemoScenarioKey = "growth";

export function getDemoScenario(key: DemoScenarioKey = DEFAULT_DEMO_SCENARIO_KEY) {
  return DEMO_SCENARIOS.find((scenario) => scenario.key === key) ?? DEMO_SCENARIOS[0];
}

export function getDemoScenarioByCabinetId(cabinetId?: string | null): DemoScenario {
  return DEMO_SCENARIOS.find((scenario) => scenario.cabinetId === cabinetId) ?? getDemoScenario();
}
