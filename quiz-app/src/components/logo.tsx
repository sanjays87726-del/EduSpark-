export function Logo({ className = "size-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect width="48" height="48" rx="14" fill="var(--primary)" />
      <path
        d="M14 18.5c4.2-2.4 7.2-2.4 10 0 2.8-2.4 5.8-2.4 10 0V32c-4.2-2.2-7.2-2.2-10 0-2.8-2.2-5.8-2.2-10 0V18.5Z"
        fill="var(--on-primary)"
      />
      <path d="M24 16.2 25.4 19.6 29 21l-3.6 1.4L24 25.8l-1.4-3.4L19 21l3.6-1.4L24 16.2Z" fill="var(--accent)" />
    </svg>
  );
}
