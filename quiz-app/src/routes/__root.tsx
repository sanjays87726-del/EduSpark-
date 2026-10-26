import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { PrefsProvider } from "@/components/prefs";
import { AuthProvider } from "@/lib/auth/provider";
import appCss from "../styles.css?url";

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("es-theme");var dark=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);if(dark)document.documentElement.classList.add("dark");var l=localStorage.getItem("es-lang");document.documentElement.lang=l==="en"?"en":"hi";}catch(e){}})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "EduSpark Quiz" },
      { name: "description", content: "Hindi and English quizzes for school and competitive exam practice." },
      { name: "theme-color", content: "#1d4e89" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&family=Outfit:wght@400;500;600;700&display=swap",
      },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: Root,
});

function Root() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 4000, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <html lang="hi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <QueryClientProvider client={client}>
          <AuthProvider>
            <PrefsProvider>
              <Outlet />
              <Toaster position="top-center" />
            </PrefsProvider>
          </AuthProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
