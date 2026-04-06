import { PageHeader } from "@/components/page-header";
import { UnitEconomicsCalculator } from "@/components/unit-economics-calculator";

export const dynamic = "force-dynamic";

export default function CalculatorPage() {
  return (
    <main className="page">
      <PageHeader
        title="Калькулятор юнит-экономики"
        description="Быстрый расчёт решения по SKU: прибыль, маржа, безопасная цена и лимиты по расходам."
      />
      <UnitEconomicsCalculator />
    </main>
  );
}
