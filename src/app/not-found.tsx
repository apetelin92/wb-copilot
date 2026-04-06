import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="screen-message">
      <h2>Страница не найдена</h2>
      <p className="muted">Возможно, SKU уже неактивен или ссылка устарела.</p>
      <Link className="button button--primary" href="/dashboard">
        Вернуться на дашборд
      </Link>
    </div>
  );
}
