import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const tournamentId = Number(id);
  if (!Number.isFinite(tournamentId)) notFound();

  const [{ data: tournament }, { data: participants }, { data: matches }] =
    await Promise.all([
      supabase.from("tournaments").select("*").eq("id", tournamentId).single(),
      supabase
        .from("tournament_players")
        .select("players(id, nickname)")
        .eq("tournament_id", tournamentId),
      supabase
        .from("matches")
        .select("*, maps(name)")
        .eq("tournament_id", tournamentId)
        .order("played_at", { ascending: false }),
    ]);

  if (!tournament) notFound();

  return (
    <section className="flex flex-col gap-6">
      <div className="card">
        <h1 className="text-3xl font-bold">{tournament.name}</h1>
        {tournament.description && (
          <p className="mt-2 text-slate-300">{tournament.description}</p>
        )}
        {tournament.starts_at && (
          <p className="mt-2 text-sm text-slate-500">
            Начало: {new Date(tournament.starts_at).toLocaleString("ru-RU")}
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 text-lg font-bold text-orange-400">Участники ({participants?.length ?? 0})</h2>
        <div className="flex flex-wrap gap-2">
          {participants?.map((p) => {
            const player = p.players as unknown as { id: number; nickname: string } | null;
            if (!player) return null;
            return (
              <Link
                key={player.id}
                href={`/players/${player.id}`}
                className="rounded-full border border-slate-700 px-3 py-1 text-sm hover:border-orange-500"
              >
                {player.nickname}
              </Link>
            );
          })}
          {!participants?.length && (
            <p className="text-sm text-slate-500">Участники ещё не добавлены</p>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-lg font-bold text-orange-400">Матчи</h2>
        {matches?.length ? (
          <ul className="divide-y divide-slate-800">
            {matches.map((m) => {
              const map = (m as { maps?: { name: string } | null }).maps;
              return (
                <li key={m.id} className="flex items-center justify-between py-3">
                  <span className="text-slate-300">
                    {m.team1_name} <b className="text-white">{m.team1_score}</b>
                    {" : "}
                    <b className="text-white">{m.team2_score}</b> {m.team2_name}
                  </span>
                  <span className="text-sm text-slate-400">
                    {map?.name ?? "карта неизвестна"}
                    {!m.parsed && (
                      <span className="badge ml-2 bg-yellow-500/15 text-yellow-400">не разобрана</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Матчей пока нет</p>
        )}
      </div>
    </section>
  );
}
