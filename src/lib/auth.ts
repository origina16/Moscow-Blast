import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Возвращает профиль текущего пользователя или null. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, created_at")
    .eq("id", user.id)
    .single();

  return (profile as Profile) ?? null;
}

/** Для серверных страниц/экшенов раздела /organizer — редирект, если не организатор. */
export async function requireOrganizer(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "organizer") redirect("/tournaments");
  return profile;
}
