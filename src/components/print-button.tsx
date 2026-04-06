"use client";

export function PrintButton() {
  return (
    <button className="button button--secondary print-hidden" type="button" onClick={() => window.print()}>
      Сохранить в PDF
    </button>
  );
}
