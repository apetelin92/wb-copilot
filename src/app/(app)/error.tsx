"use client";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  const isChunkLoadError = /loading chunk|chunkloaderror|failed to fetch dynamically imported module/i.test(error.message);

  return (
    <div className="screen-message">
      <h2>Не удалось открыть экран</h2>
      <p className="muted">
        {isChunkLoadError ? "Похоже, фронтенд обновился во время работы страницы. Перезагрузите приложение, чтобы подтянуть актуальные чанки." : error.message || "Произошла непредвиденная ошибка."}
      </p>
      <div className="button-row button-row--center">
        <button className="button button--secondary" onClick={() => reset()} type="button">
          Повторить
        </button>
        {isChunkLoadError ? (
          <button
            className="button button--primary"
            onClick={() => {
              window.location.reload();
            }}
            type="button"
          >
            Перезагрузить страницу
          </button>
        ) : null}
      </div>
    </div>
  );
}
