"use client";

import { useCallback, useEffect, useId, useState } from "react";

import { useTranslation } from "@/lib/i18n/context";
import { supabaseClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;

export function ChangePasswordDialog() {
  const { t } = useTranslation();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const resetForm = useCallback(() => {
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(false);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    resetForm();
  }, [resetForm]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseClient) return;

    setError(null);
    setSuccess(false);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    setBusy(true);
    const { error: updateError } = await supabaseClient.auth.updateUser({
      password: newPassword,
    });
    setBusy(false);

    if (updateError) {
      setError(updateError.message || t("auth.passwordChangeFailed"));
      return;
    }

    setSuccess(true);
    setNewPassword("");
    setConfirmPassword("");
    window.setTimeout(() => {
      setOpen(false);
      setSuccess(false);
    }, 1600);
  }

  if (!supabaseClient) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
        className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        {t("auth.changePassword")}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg"
            onMouseDown={(ev) => ev.stopPropagation()}
          >
            <h2 id={titleId} className="text-lg font-semibold text-[var(--artifex-navy)]">
              {t("auth.changePasswordTitle")}
            </h2>
            <p className="mt-1 text-xs text-slate-500">{t("auth.changePasswordHint")}</p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label htmlFor="new-pw" className="mb-1 block text-xs font-medium text-slate-600">
                  {t("auth.newPassword")}
                </label>
                <input
                  id="new-pw"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(ev) => setNewPassword(ev.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="confirm-pw" className="mb-1 block text-xs font-medium text-slate-600">
                  {t("auth.confirmPassword")}
                </label>
                <input
                  id="confirm-pw"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(ev) => setConfirmPassword(ev.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              {error ? <p className="text-xs text-red-700">{error}</p> : null}
              {success ? <p className="text-xs text-emerald-700">{t("auth.passwordChanged")}</p> : null}

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[var(--artifex-navy)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? t("auth.savingPassword") : t("auth.savePassword")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
