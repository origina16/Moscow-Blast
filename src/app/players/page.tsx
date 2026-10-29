import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeAverages, ratingScore } from "@/lib/stats";
import type { PlayerMatchStatsRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const supabase = await createClient();

  const [{ data: players }, { data: stats }] = await Promise.all([
    supabase.from("players").select("id, nickname").order("nickname"),
    supabase.from("player_match_stats").select("*"),
  ]);

  if (!players?.length) {
    return (
      <div className="card text-slate-300">
        Игроки появятся, как только организатор создаст первый турнир и загрузит демки.
      </div>
    );
  }

  const rows: PlayerMatchStatsRow[] = (stats ?? []) as PlayerMatchStatsRow[];

  const list = players
    .map((p) => {
      const own = rows.filter((r) => r.player_id === p.id);
      const avg = computeAverages(own);
      return { ...p, avg, rating: ratingScore(avg) };
    })
    .sort((a, b) => b.rating - a.rating);

  return (
    <section>
      <h1 className="mb-6 text-3xl font-bold">Игроки</h1>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-slate-400">
              <th className="px-4 py-3">Игрок</th>
              <th className="px-4 py-3">Игр</th>
              <th className="px-4 py-3">Рейтинг</th>
              <th className="px-4 py-3">K/D</th>
              <th className="px-4 py-3">Kills за игру</th>
              <th className="px-4 py-3">ADR</th>
              <th className="px-4 py-3">HS%</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-b border-slate-800/60 hover:bg-slate-900/40">
                <td className="px-4 py-3">
                  <Link href={`/players/${p.id}`} className="font-semibold hover:text-orange-400">
                    {p.nickname}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-300">{p.avg.games}</td>
                <td className="px-4 py-3 font-bold text-orange-400">{p.rating}</td>
                <td className="px-4 py-3 text-slate-300">{p.avg.kd}</td>
                <td className="px-4 py-3 text-slate-300">{p.avg.kills}</td>
                <td className="px-4 py-3 text-slate-300">{p.avg.adr}</td>
                <td className="px-4 py-3 text-slate-300">{p.avg.hsPercent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
