import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Серверный клиент с service role — обходит RLS.
 * Использовать ТОЛЬКО в Server Actions после проверки роли организатора.
 */
export function createAdminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY не задан в .env.local — добавьте service_role ключ из Supabase (Project Settings → API) и перезапустите dev-сервер",
    );
  }
  // Поддерживаем оба формата ключей Supabase:
  //  - классический JWT service_role: eyJxxx.yyy.zzz (три части через точки)
  //  - новый формат: sb_secret_...
  const isLegacyJwt = key.split(".").length === 3;
  const isSecretKey = key.startsWith("sb_secret_");
  if (!isLegacyJwt && !isSecretKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY выглядит некорректно. Ожидался классический JWT (eyJ...) или новый ключ sb_secret_... из Project Settings → API. Значение должно быть без кавычек, хвостов вида ', service_role' и пробелов",
    );
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
