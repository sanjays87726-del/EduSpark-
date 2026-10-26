import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bookmark,
  Compass,
  GraduationCap,
  Home,
  Menu,
  PenLine,
  Settings,
  Timer,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Logo } from "@/components/logo";
import { usePrefs } from "@/components/prefs";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMe } from "@/lib/eduspark/api";
import { cn } from "@/lib/cn";

const primary = [
  { to: "/", hi: "होम", en: "Home", icon: Home },
  { to: "/explore", hi: "खोज", en: "Explore", icon: Compass },
  { to: "/practice", hi: "अभ्यास", en: "Practice", icon: PenLine },
  { to: "/progress", hi: "प्रगति", en: "Progress", icon: BarChart3 },
] as const;

const more = [
  { to: "/mocks", hi: "मॉक टेस्ट", en: "Mock tests", icon: Timer },
  { to: "/leaderboard", hi: "लीडरबोर्ड", en: "Leaderboard", icon: Trophy },
  { to: "/bookmarks", hi: "बुकमार्क", en: "Bookmarks", icon: Bookmark },
  { to: "/profile", hi: "प्रोफ़ाइल", en: "Profile", icon: UserRound },
  { to: "/settings", hi: "सेटिंग", en: "Settings", icon: Settings },
] as const;

function isOn(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function Shell() {
  const { bi, lang, setLang } = usePrefs();
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe(), enabled: Boolean(user) && !isPending });
  const focus = pathname.startsWith("/play") || pathname.startsWith("/results");
  const staff = me.data?.role === "admin" || me.data?.role === "teacher";

  const item = (to: string, label: string, Icon: typeof Home, dock = false) => (
    <Link
      key={to}
      to={to}
      onClick={() => setOpen(false)}
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
        dock ? "min-h-12 flex-1 flex-col gap-0.5 px-1 text-[11px]" : "min-h-11",
        isOn(pathname, to) ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2 hover:text-ink",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Logo className="size-9" />
            <span>EduSpark</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="min-h-11 rounded-xl px-3 text-sm font-semibold text-primary"
              onClick={() => setLang(lang === "hi" ? "en" : "hi")}
            >
              {lang === "hi" ? "EN" : "हि"}
            </button>
            {isPending ? (
              <span className="size-9 animate-pulse rounded-full bg-surface-2" />
            ) : user ? (
              <UserButton />
            ) : (
              <Link to="/login" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-3 text-sm font-semibold text-on-primary">
                {bi("प्रवेश", "Sign in")}
              </Link>
            )}
          </div>
        </div>
      </header>
      <div className={cn("mx-auto grid max-w-6xl gap-6 px-4 pt-4", focus ? "pb-8" : "pb-24 md:pb-10 md:grid-cols-[220px_minmax(0,1fr)]")}>
        {!focus ? (
          <aside className="hidden md:block">
            <nav className="sticky top-20 space-y-1" aria-label={bi("मुख्य", "Primary")}>
              {primary.map((link) => item(link.to, bi(link.hi, link.en), link.icon))}
              <div className="my-3 h-px bg-line" />
              {more.map((link) => item(link.to, bi(link.hi, link.en), link.icon))}
              {staff ? item("/admin", bi("प्रशासन", "Admin"), GraduationCap) : null}
            </nav>
          </aside>
        ) : null}
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
      {!focus ? (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface md:hidden" aria-label={bi("निचला मेनू", "Bottom")}>
          <div className="flex">
            {primary.map((link) => item(link.to, bi(link.hi, link.en), link.icon, true))}
            <button type="button" className="flex min-h-12 flex-1 flex-col items-center justify-center text-[11px] font-medium text-muted" onClick={() => setOpen(true)}>
              <Menu className="size-5" aria-hidden="true" />
              {bi("और", "More")}
            </button>
          </div>
        </nav>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label={bi("बंद करें", "Close")} onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 space-y-1 rounded-t-3xl bg-surface p-4 pb-8">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold">{bi("और विकल्प", "More")}</p>
              <button type="button" className="grid size-11 place-items-center rounded-xl" onClick={() => setOpen(false)} aria-label={bi("बंद करें", "Close")}>
                <X className="size-5" />
              </button>
            </div>
            {more.map((link) => item(link.to, bi(link.hi, link.en), link.icon))}
            {staff ? item("/admin", bi("प्रशासन", "Admin"), GraduationCap) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
