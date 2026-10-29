import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Tournament } from "@/lib/types";

export const dynamic = "force-dynamic";

const statusLabels: Record<Tournament["status"], { label: string; cls: string }> = {
  upcoming: { label: "Скоро", cls: "bg-blue-500/15 text-blue-400" },
  live: { label: "Идёт", cls: "bg-green-500/15 text-green-400" },
  finished: { label: "Завершён", cls: "bg-slate-500/20 text-slate-400" },
};

export default async function TournamentsPage() {
  const supabase = await createClient();
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("*")
    .order("created_at", { ascending: false });

  if (!tournaments?.length) {
    return (
      <div className="card text-slate-300">
        Турниров пока нет.{" "}
        <Link href="/organizer" className="text-orange-400 hover:underline">
          Организуйте первый турнир
        </Link>
        .
      </div>
    );
  }

  return (
    <section>
      <h1 className="mb-6 text-3xl font-bold">Турниры</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {tournaments.map((t: Tournament) => {
          const s = statusLabels[t.status] ?? statusLabels.upcoming;
          return (
            <Link
              key={t.id}
              href={`/tournaments/${t.id}`}
              className="card transition hover:border-orange-500/40"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold">{t.name}</h2>
                <span className={`badge ${s.cls}`}>{s.label}</span>
              </div>
              {t.description && (
                <p className="mt-2 line-clamp-2 text-sm text-slate-400">{t.description}</p>
              )}
              {t.starts_at && (
                <p className="mt-3 text-xs text-slate-500">
                  Начало: {new Date(t.starts_at).toLocaleString("ru-RU")}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
