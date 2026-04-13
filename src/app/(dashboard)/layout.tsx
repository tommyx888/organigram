"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ChangePasswordDialog } from "@/components/auth/change-password-dialog";
import { AuthProvider, type AuthContextValue, type UserRole } from "@/components/auth/auth-context";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useTranslation } from "@/lib/i18n/context";
import { isSupabasePublicConfigured, supabaseClient } from "@/lib/supabase/client";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export default function DashboardLayout(props: DashboardLayoutProps) {
  const { t } = useTranslation();
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [authState, setAuthState] = useState<{
    authenticated: boolean;
    role: UserRole | null;
    userEmail: string | null;
  }>({
    authenticated: !isSupabasePublicConfigured,
    role: isSupabasePublicConfigured ? null : "admin",
    userEmail: null,
  });

  useEffect(() => {
    async function initialize() {
      if (!isSupabasePublicConfigured || !supabaseClient) {
        setStatus("ready");
        return;
      }

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session?.user) {
        setAuthState({ authenticated: false, role: null, userEmail: null });
        setStatus("ready");
        return;
      }

      const role = await resolveUserRole(session.user.id);
      setAuthState({
        authenticated: true,
        role: role ?? "viewer",
        userEmail: session.user.email ?? null,
      });
      setStatus("ready");
    }

    void initialize();
  }, []);

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      isConfigured: isSupabasePublicConfigured,
      authenticated: authState.authenticated,
      role: authState.role,
      userEmail: authState.userEmail,
    }),
    [authState.authenticated, authState.role, authState.userEmail],
  );

  async function handlePasswordLogin() {
    if (!supabaseClient || !isSupabasePublicConfigured || !emailInput.trim() || !passwordInput) {
      return;
    }

    setAuthBusy(true);
    setAuthError(null);

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: emailInput.trim(),
      password: passwordInput,
    });

    if (error || !data.user) {
      setAuthError(error?.message ?? t("auth.loginFailed"));
      setAuthBusy(false);
      return;
    }

    const role = await resolveUserRole(data.user.id);
    setAuthState({
      authenticated: true,
      role: role ?? "viewer",
      userEmail: data.user.email ?? emailInput.trim(),
    });
    setAuthBusy(false);
  }

  async function handleSignOut() {
    if (!supabaseClient) {
      return;
    }
    await supabaseClient.auth.signOut();
    setAuthState({ authenticated: false, role: null, userEmail: null });
  }

  if (status === "loading") {
    return <div className="p-6 text-sm text-slate-600">{t("auth.loading")}</div>;
  }

  if (isSupabasePublicConfigured && !authState.authenticated) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-12">
        <div className="absolute right-6 top-6 flex items-center gap-3">
          <a
            href="#login-form"
            className="rounded-lg border border-[var(--artifex-navy)] bg-white px-3 py-2 text-sm font-semibold text-[var(--artifex-navy)] transition hover:bg-slate-50"
          >
            {t("auth.loginButton")}
          </a>
          <LanguageSwitcher />
        </div>
        <section id="login-form" className="mx-auto max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm scroll-mt-24">
          <h1 className="text-xl font-semibold text-[var(--artifex-navy)]">{t("auth.loginTitle")}</h1>
          <p className="text-sm text-slate-600">{t("auth.loginDesc")}</p>
          <input
            type="email"
            value={emailInput}
            onChange={(event) => setEmailInput(event.target.value)}
            placeholder={t("auth.emailPlaceholder")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={passwordInput}
            onChange={(event) => setPasswordInput(event.target.value)}
            placeholder={t("auth.passwordPlaceholder")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handlePasswordLogin}
            disabled={authBusy}
            className="w-full rounded-lg bg-[var(--artifex-navy)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {authBusy ? t("auth.loggingIn") : t("auth.loginButton")}
          </button>
          {authError ? <p className="text-xs text-red-700">{authError}</p> : null}
          <Link href="/" className="block text-center text-xs text-slate-500 underline">
            {t("auth.backToHome")}
          </Link>
        </section>
      </main>
    );
  }

  return (
    <AuthProvider value={contextValue}>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1720px] items-center justify-between px-6 py-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">{t("auth.dashboard")}</span>
            <span>{t("auth.role")}: {authState.role ?? t("auth.roleN/A")}</span>
            {authState.userEmail ? <span>• {authState.userEmail}</span> : null}
            {isSupabasePublicConfigured && authState.role === "viewer" ? (
              <span className="text-amber-700">• {t("auth.readOnlyFallback")}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            {isSupabasePublicConfigured ? (
              <>
                <ChangePasswordDialog />
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded border border-slate-300 px-2 py-1 font-semibold text-slate-700"
                >
                  {t("auth.signOut")}
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
      {props.children}
    </AuthProvider>
  );
}

async function resolveUserRole(userId: string): Promise<UserRole | null> {
  if (!supabaseClient) {
    return null;
  }

  try {
    const { data, error } = await supabaseClient
      .from("user_company_roles")
      .select("role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const role = data.role as UserRole;
    return role === "admin" || role === "hr_editor" || role === "viewer" ? role : null;
  } catch {
    return null;
  }
}
