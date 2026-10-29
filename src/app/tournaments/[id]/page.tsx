import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MatchRow, Series as SeriesRow, Team } from "@/lib/types";
import { computeStandings } from "@/lib/bracket";

export const dynamic = "force-dynamic";

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournamentId = Number(id);
  if (!Number.isFinite(tournamentId)) notFound();

  const supabase = await createClient();
  const [{ data: tournament }, { data: teams }, { data: series }, { data: matches }] =
    await Promise.all([
      supabase.from("tournaments").select("*").eq("id", tournamentId).single(),
      supabase.from("teams").select("*").eq("tournament_id", tournamentId).order("name"),
      supabase
        .from("series")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("stage, round, id"),
      supabase
        .from("matches")
        .select("*, maps(name)")
        .eq("tournament_id", tournamentId)
        .order("played_at", { ascending: false }),
    ]);

  if (!tournament) notFound();

  if (tournament.format === "teams_6x5" && teams && series) {
    return (
      <TeamFormatPublic
        name={tournament.name}
        description={tournament.description}
        startsAt={tournament.starts_at}
        status={tournament.status}
        teams={teams as Team[]}
        series={series as SeriesRow[]}
        matches={(matches ?? []) as unknown as (MatchRow & { maps: { name: string } | null })[]}
      />
    );
  }

  /* ---------- Простой режим ---------- */
  const { data: participants } = await supabase
    .from("tournament_players")
    .select("players(id, nickname)")
    .eq("tournament_id", tournamentId);

  return (
    <section className="flex flex-col gap-6">
      <div className="card">
        <h1 className="text-3xl font-bold">{tournament.name}</h1>
        {tournament.description && <p className="mt-2 text-slate-300">{tournament.description}</p>}
      </div>

      <div className="card">
        <h2 className="mb-3 text-lg font-bold text-orange-400">Участники ({participants?.length ?? 0})</h2>
        <div className="flex flex-wrap gap-2">
          {participants?.map((p) => {
            const player = p.players as unknown as { id: number; nickname: string } | null;
            if (!player) return null;
            return (
              <Link key={player.id} href={`/players/${player.id}`}
                    className="rounded-full border border-slate-700 px-3 py-1 text-sm hover:border-orange-500">
                {player.nickname}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-lg font-bold text-orange-400">Матчи</h2>
        {matches?.length ? (
          <ul className="divide-y divide-slate-800">
            {(matches as unknown as (MatchRow & { maps: { name: string } | null })[]).map((m) => (
              <li key={m.id} className="flex items-center justify-between py-3">
                <span className="text-slate-300">
                  {m.team1_name} <b className="text-white">{m.team1_score}</b>
                  {" : "}
                  <b className="text-white">{m.team2_score}</b> {m.team2_name}
                </span>
                <span className="text-sm text-slate-400">{m.maps?.name ?? "—"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Матчей пока нет</p>
        )}
      </div>
    </section>
  );
}

/* ================= Публичная страница: 6 команд ================= */

function TeamFormatPublic({
  name,
  description,
  startsAt,
  status,
  teams,
  series,
  matches,
}: {
  name: string;
  description: string | null;
  startsAt: string | null;
  status: string;
  teams: Team[];
  series: SeriesRow[];
  matches: (MatchRow & { maps: { name: string } | null })[];
}) {
  const teamName = (tid: number | null) => teams.find((t) => t.id === tid)?.name ?? "—";

  const standings = computeStandings(teams, series, matches);

  const byStage = (stage: SeriesRow["stage"], group?: string) =>
    series.filter((s) => s.stage === stage && (group == null || s.group_name === group));

  const renderSeries = (items: SeriesRow[]) => (
    <ul className="divide-y divide-slate-800">
      {items.map((s) => {
        const mapsOfSeries = matches.filter((m) => m.series_id === s.id);
        const done = s.status === "finished";
        const winner = done ? (s.team1_wins > s.team2_wins ? s.team1_id : s.team2_id) : null;
        return (
          <li key={s.id} className="py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-200">
                {teamName(s.team1_id)} <b className={done ? "text-green-400" : "text-slate-400"}>{s.team1_wins}</b>
                {" : "}
                <b className={done ? "text-green-400" : "text-slate-400"}>{s.team2_wins}</b> {teamName(s.team2_id)}
              </span>
              <span className={`badge ${done ? "bg-green-500/15 text-green-400" : s.status === "live" ? "bg-blue-500/15 text-blue-400" : "bg-slate-500/20 text-slate-400"}`}>
                {done ? "Б03 завершена" : s.status === "live" ? "идёт" : "ожидается"}
              </span>
            </div>
            {mapsOfSeries.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs text-slate-400">
                {mapsOfSeries.map((m) => {
                  const t1WinsMap = m.team1_score > m.team2_score;
                  return (
                    <li key={m.id}>
                      {m.maps?.name ?? "карта"}: {t1WinsMap ? m.team1_score : m.team2_score}
                      {" : "}
                      {t1WinsMap ? m.team2_score : m.team1_score} → {teamName(t1WinsMap ? m.match_team1_id : m.match_team2_id)}
                    </li>
                  );
                })}
              </ul>
            )}
            {winner != null && (
              <p className="mt-1 text-xs text-slate-500">→ дальше: {teamName(winner)}</p>
            )}
          </li>
        );
      })}
    </ul>
  );

  const semis = byStage("semifinal");
  const finalSeries = byStage("final");

  return (
    <section className="flex flex-col gap-6">
      <div className="card">
        <h1 className="text-3xl font-bold">{name}</h1>
        {description && <p className="mt-2 text-slate-300">{description}</p>}
        <p className="mt-2 text-sm text-slate-500">
          Формат: 6 команд × 5 игроков · группы A/B · сетка · всё Bo3
          {startsAt && ` · старт: ${new Date(startsAt).toLocaleString("ru-RU")}`}
        </p>
      </div>

      {/* Группы */}
      {(["A", "B"] as const).map((letter) => (
        <div key={letter} className="card">
          <h2 className="text-lg font-bold text-orange-400">Группа {letter}</h2>
          <table className="mt-3 w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-slate-400">
                <th className="py-2">Команда</th>
                <th className="py-2">Игр</th>
                <th className="py-2">W–L (Bo3)</th>
                <th className="py-2">Карты</th>
                <th className="py-2">+/-</th>
              </tr>
            </thead>
            <tbody>
              {standings[letter].map((row, i) => (
                <tr key={row.teamId} className="border-b border-slate-800/50">
                  <td className="py-2 font-semibold">
                    {i === 0 && <span className="mr-1 text-green-400">▲</span>}
                    {row.teamName}
                  </td>
                  <td className="py-2 text-slate-300">{row.played}</td>
                  <td className="py-2 text-slate-300">{row.seriesWins}–{row.seriesLosses}</td>
                  <td className="py-2 text-slate-400">{row.mapWins}–{row.mapLosses}</td>
                  <td className="py-2 text-slate-400">{row.mapWins - row.mapLosses > 0 ? "+" : ""}{row.mapWins - row.mapLosses}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {byStage("group", letter).length > 0 && (
            <div className="mt-4">{renderSeries(byStage("group", letter))}</div>
          )}
        </div>
      ))}

      {/* Сетка */}
      {(semis.length > 0 || finalSeries.length > 0 || series.every((s) => s.stage === "group")) && (
        <div className="card">
          <h2 className="text-lg font-bold text-orange-400">Плей-офф сетка</h2>
          <div className="mt-3 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-1 text-sm font-bold text-slate-300">Полуфиналы</h3>
              {semis.length > 0 ? renderSeries(semis) : (
                <p className="text-sm text-slate-500">Ожидаются: A1–B2 и B1–A2</p>
              )}
            </div>
            <div>
              <h3 className="mb-1 text-sm font-bold text-slate-300">Финал</h3>
              {finalSeries.length > 0 ? renderSeries(finalSeries) : (
                <p className="text-sm text-slate-500">Появится после полуфиналов</p>
              )}
              {finalSeries.some((s) => s.status === "finished") && (
                <p className="mt-2 text-lg font-bold text-green-400">
                  🏆 Чемпион: {teamName(finalSeries[0].team1_wins > finalSeries[0].team2_wins ? finalSeries[0].team1_id : finalSeries[0].team2_id)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Составы команд */}
      <div className="card">
        <h2 className="text-lg font-bold text-orange-400">Составы</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <RosterCards teams={teams} />
        </div>
      </div>
    </section>
  );
}

async function RosterCards({ teams }: { teams: Team[] }) {
  const supabase = await createClient();
  const { data: tp } = await supabase
    .from("team_players")
    .select("team_id, is_captain, players(id, nickname)")
    .in("team_id", teams.map((t) => t.id));
  return (
    <>
      {teams.map((t) => (
        <div key={t.id} className="rounded-lg border border-slate-800 p-3">
          <h3 className="font-bold">{t.name}</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {(tp ?? [])
              .filter((x) => x.team_id === t.id)
              .map((row) => {
                const p = row.players as unknown as { id: number; nickname: string } | null;
                if (!p) return null;
                return (
                  <li key={p.id}>
                    {row.is_captain && <span className="text-amber-400" title="Капитан">★ </span>}
                    <Link href={`/players/${p.id}`} className="hover:text-orange-400">{p.nickname}</Link>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </>
  );
}
