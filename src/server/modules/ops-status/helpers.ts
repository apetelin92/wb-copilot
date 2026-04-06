import { SyncRunStatus } from "@prisma/client";

export function humanizeSyncErrorMessage(message?: string | null) {
  if (!message) {
    return null;
  }

  const normalized = message.toLowerCase();

  if (normalized.includes("не удалось проверить доступ к api wb")) {
    return "Не удалось проверить доступ к WB API. Проверьте токен и права на контент и статистику.";
  }

  if (normalized.includes("failed to reach wildberries apis") || normalized.includes("wb request failed after retries")) {
    return "Не удалось связаться с WB API. Повторите синхронизацию позже или проверьте сеть и токен.";
  }

  if (normalized.includes("wb request failed") || normalized.includes("wb_request_failed")) {
    return "WB API вернул ошибку. Проверьте токен, лимиты запросов или повторите синхронизацию позже.";
  }

  if (normalized.includes("wb_connection_missing")) {
    return "Сначала подключите кабинет WB, затем повторите синхронизацию.";
  }

  if (normalized.includes("wb_connection_not_ready")) {
    return "Подключение WB не готово. Проверьте токен и статус подключения в настройках.";
  }

  if (normalized.includes("invalid_sync_window")) {
    return "Период синхронизации задан неверно. Проверьте даты и повторите запуск.";
  }

  if (normalized.includes("sync_already_running")) {
    return "Синхронизация уже идёт. Дождитесь завершения текущего запуска.";
  }

  return message;
}

export function buildSyncFreshnessStatus(input: {
  latestCompletedAt?: Date | null;
  latestSyncStatus?: SyncRunStatus | null;
  latestSyncStartedAt?: Date | null;
  latestFailureMessage?: string | null;
  staleAfterHours: number;
}) {
  const latestCompletedAt = input.latestCompletedAt ?? null;
  const latestSyncStartedAt = input.latestSyncStartedAt ?? null;

  if (!latestCompletedAt) {
    return {
      state: "never" as const,
      tone: "warning" as const,
      label: "Данные не загружены",
      description: "Первая синхронизация ещё не запускалась. До неё расчёты по прибыли и кассе неполные."
    };
  }

  const ageHours = (Date.now() - latestCompletedAt.getTime()) / (1000 * 60 * 60);
  const humanizedError = humanizeSyncErrorMessage(input.latestFailureMessage);
  const hasNewerFailure = Boolean(
    input.latestSyncStatus === SyncRunStatus.FAILED && latestSyncStartedAt && latestSyncStartedAt.getTime() >= latestCompletedAt.getTime()
  );

  if (hasNewerFailure) {
    return {
      state: "failed" as const,
      tone: "danger" as const,
      label: "Последний sync завершился с ошибкой",
      description: humanizedError ?? "Последняя синхронизация не завершилась. Данные могут быть неактуальны."
    };
  }

  if (ageHours > input.staleAfterHours) {
    return {
      state: "stale" as const,
      tone: "warning" as const,
      label: "Данные устарели",
      description: `Последний успешный sync был более ${input.staleAfterHours} ч назад. Перед решениями лучше обновить данные.`
    };
  }

  return {
    state: "fresh" as const,
    tone: "success" as const,
    label: "Данные свежие",
    description: "Последний успешный sync недавний, на эти цифры можно опираться в текущем дне."
  };
}
