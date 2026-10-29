"use client";

import { useActionState } from "react";
import type { AuthState } from "@/app/actions/auth";

type AuthAction = (
  prevState: AuthState,
  formData: FormData,
) => Promise<AuthState>;

export default function AuthForm({
  action,
  mode,
}: {
  action: AuthAction;
  mode: "login" | "register";
}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, null);

  return (
    <form action={formAction} className="card flex flex-col gap-4">
      {mode === "register" && (
        <div>
          <label className="label" htmlFor="nickname">Никнейм в игре (Fastcup)</label>
          <input id="nickname" name="nickname" className="input" placeholder="Например: s1mple" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Пароль</label>
        <input id="password" name="password" type="password" className="input" required minLength={6} />
      </div>
      {mode === "register" && (
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" name="organizer" className="size-4 accent-orange-500" />
          Я организатор турниров
        </label>
      )}
      {state?.error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{state.error}</p>
      )}
      <button type="submit" disabled={pending} className="btn disabled:opacity-50">
        {pending ? "Подождите..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
      </button>
    </form>
  );
}
