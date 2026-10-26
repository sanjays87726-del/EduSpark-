import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Lang, ThemeChoice } from "@/lib/eduspark/types";

type Prefs = {
  lang: Lang;
  theme: ThemeChoice;
  setLang: (lang: Lang) => void;
  setTheme: (theme: ThemeChoice) => void;
  bi: (hi: string, en: string) => string;
};

const Ctx = createContext<Prefs | null>(null);

function applyTheme(theme: ThemeChoice) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("hi");
  const [theme, setThemeState] = useState<ThemeChoice>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedLang = localStorage.getItem("es-lang");
    const storedTheme = localStorage.getItem("es-theme");
    if (storedLang === "en" || storedLang === "hi") setLangState(storedLang);
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
      setThemeState(storedTheme);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyTheme(theme);
    document.documentElement.lang = lang === "en" ? "en" : "hi";
    localStorage.setItem("es-lang", lang);
    localStorage.setItem("es-theme", theme);
  }, [lang, theme, ready]);

  const value = useMemo<Prefs>(
    () => ({
      lang,
      theme,
      setLang: setLangState,
      setTheme: setThemeState,
      bi: (hi, en) => (lang === "en" ? en : hi),
    }),
    [lang, theme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("prefs");
  return ctx;
}
