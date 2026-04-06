"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function SubmitButton({ children, pendingText, variant = "primary" }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button className={`button button--${variant}`} type="submit" disabled={pending}>
      {pending ? pendingText ?? "Сохраняем..." : children}
    </button>
  );
}
