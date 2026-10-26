import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function cnJoin(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-surface p-4 shadow-sm", className)}>
      {children}
    </section>
  );
}

const styles = {
  primary: "bg-primary text-on-primary hover:opacity-90",
  soft: "bg-primary-soft text-primary",
  ghost: "bg-transparent text-ink hover:bg-surface-2",
  outline: "border border-line bg-surface text-ink hover:bg-surface-2",
  danger: "bg-bad text-white",
} as const;

export function Btn({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof styles }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        className,
      )}
    />
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none ring-primary focus:ring-2";

export function Banner({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-accent-soft px-3 py-2 text-xs leading-5 text-ink">{children}</p>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorNote({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-bad/30 bg-bad-soft px-4 py-4 text-sm" role="alert">
      <p>{text}</p>
      {onRetry ? (
        <button type="button" className="mt-3 font-semibold text-primary" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-surface-2", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-28 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </div>
  );
}

export function explainError(err: unknown, bi: (hi: string, en: string) => string) {
  const code = err instanceof Error ? err.message : "";
  if (code.includes("Unauthorized")) return bi("सत्र समाप्त हो गया। फिर से प्रवेश करें।", "Your session expired. Sign in again.");
  if (code.includes("RATE_LIMIT")) return bi("बहुत तेज़ अनुरोध। थोड़ी देर रुकें।", "Too many requests. Please wait.");
  if (code.includes("EMPTY")) return bi("इस चयन में अभी कोई प्रश्न नहीं है।", "No questions match this selection yet.");
  if (code.includes("FORBIDDEN")) return bi("इस काम की अनुमति नहीं है।", "You are not allowed to do that.");
  if (code.includes("DUPLICATE")) return bi("ऐसा प्रश्न पहले से है।", "That question already exists.");
  if (code.includes("LAST_ADMIN")) return bi("आखिरी व्यवस्थापक खाता नहीं हट सकता।", "The last admin account cannot be removed.");
  if (code.includes("LOCKED")) return bi("जाँच के बाद उत्तर नहीं बदल सकते।", "The answer is locked after checking.");
  if (code.includes("VALIDATION")) return bi("जानकारी अधूरी या गलत है।", "Some information is missing or invalid.");
  if (code.includes("NOT_FOUND")) return bi("यह सामग्री नहीं मिली।", "That item was not found.");
  if (code.includes("CONFIRM")) return bi("पुष्टि का शब्द मेल नहीं खाता।", "The confirmation word did not match.");
  return bi("कुछ गड़बड़ हो गई। फिर कोशिश करें।", "Something went wrong. Please try again.");
}
