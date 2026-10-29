"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuthState = { error: string } | null;

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Заполните email и пароль" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Неверный email или пароль" };

  // Роль определяет, куда ведём пользователя
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  redirect(profile?.role === "organizer" ? "/organizer" : "/tournaments");
}

export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nickname = String(formData.get("nickname") ?? "").trim();
  const asOrganizer = formData.get("organizer") === "on";

  if (!email || password.length < 6) {
    return { error: "Email обязателен, пароль минимум 6 символов" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error || !data.user) {
    return { error: error?.message.includes("already", ) ? "Пользователь уже существует" : "Ошибка регистрации" };
  }

  // Роль ставим service-role клиентом (RLS запрещает писать в profiles напрямую)
  if (asOrganizer) {
    const admin = createAdminClient();
    await admin.from("profiles").update({ role: "organizer" }).eq("id", data.user.id);
  }

  // Привязываем nickname к записи в players (если существует игрок с таким ником)
  if (nickname) {
    try {
      const admin = createAdminClient();
      const { data: player } = await admin
        .from("players")
        .select("id")
        .ilike("nickname", nickname)
        .maybeSingle();
      if (player) {
        await admin.from("players").update({ user_id: data.user.id }).eq("id", player.id);
      } else {
        await admin.from("players").insert({ nickname, user_id: data.user.id });
      }
    } catch {
      // nickname не критичен для входа
    }
  }

  redirect(asOrganizer ? "/organizer" : "/tournaments");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
