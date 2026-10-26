import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/logo";
import { usePrefs } from "@/components/prefs";
import { Btn, Field, inputClass } from "@/components/kit";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { saveProfile } from "@/lib/eduspark/api";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { bi, lang } = usePrefs();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ack, setAck] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (!isPending && user) return <Navigate to="/" />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!authEnabled) {
      setError(bi("प्रवेश अभी बंद है।", "Sign-in is not enabled."));
      return;
    }
    if (password.length < 8) {
      setError(bi("पासवर्ड कम से कम 8 अक्षर का हो।", "Use at least 8 characters."));
      return;
    }
    if (mode === "up" && !ack) {
      setError(bi("आगे बढ़ने से पहले सहमति दें।", "Please confirm the privacy note."));
      return;
    }
    setPending(true);
    try {
      if (mode === "up") {
        const result = await authClient.signUp.email({ email, password, name: name.trim() || "Student" });
        if (result.error) throw new Error(result.error.message || "SIGNUP");
        await saveProfile({
          data: {
            displayName: name.trim() || "Student",
            preferredLanguage: lang,
            selectedClass: null,
            examTargets: [],
            selectedSubjects: [],
            dailyGoal: 10,
            showOnLeaderboard: true,
            theme: "light",
            photoUrl: null,
            onboardingDone: false,
            guardianAck: true,
          },
        });
      } else {
        const result = await authClient.signIn.email({ email, password, callbackURL: "/" });
        if (result.error) throw new Error(result.error.message || "SIGNIN");
      }
      await navigate({ to: "/" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(
        message.toLowerCase().includes("exist")
          ? bi("यह ईमेल पहले से है। प्रवेश करें।", "That email is already registered. Sign in.")
          : message.toLowerCase().includes("invalid")
            ? bi("ईमेल या पासवर्ड गलत है।", "Email or password is incorrect.")
            : bi("प्रवेश पूरा नहीं हुआ। फिर कोशिश करें।", "Could not finish sign-in. Try again."),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-5xl items-center gap-8 px-4 py-10 md:grid-cols-2">
      <section>
        <Logo className="size-14" />
        <h1 className="mt-4 text-4xl font-semibold leading-tight">
          {bi("सीखो, अभ्यास करो, आगे बढ़ो।", "Learn, practice, move ahead.")}
        </h1>
        <p className="mt-3 max-w-md text-muted">
          {bi(
            "कक्षा 6 से 12 और एसएससी, रेलवे, पुलिस व सीईटी की तैयारी के लिए प्रश्नोत्तरी।",
            "Quizzes for Classes 6–12 and SSC, Railway, police, and CET practice.",
          )}
        </p>
      </section>
      <form onSubmit={submit} className="space-y-4 rounded-3xl border border-line bg-surface p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-1">
          <button type="button" className={`min-h-11 rounded-lg text-sm font-semibold ${mode === "in" ? "bg-surface text-ink" : "text-muted"}`} onClick={() => setMode("in")}>
            {bi("प्रवेश", "Sign in")}
          </button>
          <button type="button" className={`min-h-11 rounded-lg text-sm font-semibold ${mode === "up" ? "bg-surface text-ink" : "text-muted"}`} onClick={() => setMode("up")}>
            {bi("नया खाता", "Create account")}
          </button>
        </div>
        {mode === "up" ? (
          <Field label={bi("नाम", "Name")}>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </Field>
        ) : null}
        <Field label={bi("ईमेल", "Email")}>
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </Field>
        <Field label={bi("पासवर्ड", "Password")}>
          <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "up" ? "new-password" : "current-password"} required minLength={8} />
        </Field>
        {mode === "up" ? (
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1 size-4" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            <span>
              {bi(
                "यदि मैं 18 वर्ष से कम हूँ तो अभिभावक की सहमति से खाता बना रहा हूँ। स्कूल का पता नहीं रखा जाएगा।",
                "If I am under 18, I am creating this account with a parent or guardian. We do not ask for a school address.",
              )}
            </span>
          </label>
        ) : (
          <p className="text-xs text-muted">
            {bi(
              "पासवर्ड रीसेट ईमेल इस बिल्ड में नहीं जाता। Google या X से प्रवेश कर सकते हैं, या नया खाता बनाएँ। अंदर से पासवर्ड बदला जा सकता है।",
              "Password-reset email is not sent in this build. Use Google or X, or create an account. You can change a password after you are signed in.",
            )}
          </p>
        )}
        {error ? <p className="text-sm text-bad" role="alert">{error}</p> : null}
        <Btn type="submit" className="w-full" disabled={pending}>
          {pending ? bi("रुकिए…", "Please wait…") : mode === "up" ? bi("खाता बनाएँ", "Create account") : bi("प्रवेश करें", "Sign in")}
        </Btn>
        <div className="space-y-2">
          {authEnabled
            ? GROK_PROVIDERS.map((provider) => (
                <button
                  key={provider.providerId}
                  type="button"
                  className="min-h-11 w-full rounded-xl border border-line text-sm font-semibold"
                  onClick={() => signIn(provider.providerId, { callbackURL: "/" })}
                >
                  {bi(`${provider.label} से जारी रखें`, `Continue with ${provider.label}`)}
                </button>
              ))
            : null}
        </div>
        <Link to="/" className="block text-center text-sm text-primary">
          {bi("बिना प्रवेश देखें", "Browse without signing in")}
        </Link>
      </form>
    </main>
  );
}
