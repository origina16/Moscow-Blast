import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Серверный клиент с service role — обходит RLS.
 * Использовать ТОЛЬКО в Server Actions/API после проверки роли организатора.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // URL/anon нужны тоже, но ключ ниже — сервисный
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      // переопределяем заголовок авторизации сервисным ключом
      global: {
        headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
      },
    },
  );
}
