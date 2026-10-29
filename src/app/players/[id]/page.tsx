import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeAverages, ratingScore } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isFinite(playerId)) notFound();

  const supabase = await createClient();
  const { data: player } = await supabase
    .from("players")
    .select("id, nickname")
    .eq("id", playerId)
    .single();
  if (!player) notFound();

  const { data: stats } = await supabase
    .from("player_match_stats")
    .select("*, matches(team1_name, team2_name, team1_score, team2_score, maps(name), played_at)")
    .eq("player_id", playerId)
    .order("match_id", { ascending: false });

  const avg = computeAverages((stats ?? []) as never);

  return (
    <section className="flex flex-col gap-6">
      <div className="card flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl font-bold">{player.nickname}</h1>
        <span className="text-2xl font-black text-orange-400">Рейтинг: {ratingScore(avg)}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        {[
          ["Игр", avg.games],
          ["K/D", avg.kd],
          ["Kills", avg.kills],
          ["Deaths", avg.deaths],
          ["Assists", avg.assists],
          ["ADR", avg.adr],
        ].map(([label, value]) => (
          <div key={String(label)} className="card text-center">
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="mt-1 text-xs text-slate-400">{label} (среднее)</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="mb-3 text-lg font-bold text-orange-400">История игр</h2>
        {stats?.length ? (
          <ul className="divide-y divide-slate-800">
            {stats.map((r) => {
              const m = r.matches as
                | {
                    team1_name: string;
                    team2_name: string;
                    team1_score: number;
                    team2_score: number;
                    maps: { name: string } | null;
                    played_at: string;
                  }
                | null;
              if (!m) return null;
              const myTeam = r.team === 1 ? m.team1_name : m.team2_name;
              const myScore = r.team === 1 ? m.team1_score : m.team2_score;
              const otherScore = r.team === 1 ? m.team2_score : m.team1_score;
              const win = myScore > otherScore;
              return (
                <li key={r.match_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span>
                    <b className={win ? "text-green-400" : "text-red-400"}>
                      {win ? "П" : "Пор."}
                    </b>{" "}
                    <span className="text-slate-300">
                      {myTeam} <b className="text-white">{myScore}:{otherScore}</b>
                    </span>
                  </span>
                  <span className="text-sm text-slate-400">
                    {m.maps?.name ?? "—"} · K {r.kills} / D {r.deaths} / A {r.assists} · ADR{" "}
                    {r.rounds_played > 0 ? (r.damage / r.rounds_played).toFixed(1) : "—"} · HS{" "}
                    {r.kills > 0 ? Math.round((r.hs_kills / r.kills) * 100) : 0}%
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            Матчей нет или демки ещё не загружены.{" "}
            <Link href="/players" className="text-orange-400 hover:underline">К списку игроков</Link>
          </p>
        )}
      </div>
    </section>
  );
}
