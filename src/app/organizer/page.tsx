import Link from "next/link";
import { requireOrganizer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tournament } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OrganizerPage() {
  const profile = await requireOrganizer();
  const admin = createAdminClient();
  const { data: tournaments } = await admin
    .from("tournaments")
    .select("*")
    .eq("created_by", profile.id)
    .order("created_at", { ascending: false });

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Кабинет организатора</h1>
        <Link href="/organizer/tournaments/new" className="btn">
          + Создать турнир
        </Link>
      </div>

      {tournaments?.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {tournaments.map((t: Tournament) => (
            <Link
              key={t.id}
              href={`/organizer/tournaments/${t.id}`}
              className="card transition hover:border-orange-500/40"
            >
              <h2 className="text-lg font-bold">{t.name}</h2>
              <p className="mt-1 text-sm text-slate-400">
                {t.status === "finished" ? "Завершён" : t.status === "live" ? "Идёт" : "Скоро"}
                {t.starts_at ? ` · ${new Date(t.starts_at).toLocaleDateString("ru-RU")}` : ""}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card text-slate-300">
          У вас пока нет турниров. Создайте первый и добавьте участников.
        </div>
      )}
    </section>
  );
}
