import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { MatchRow, Series, Team } from "@/lib/types";
import { computeStandings, rostersComplete } from "@/lib/bracket";
import { addPlayerAction, removePlayerAction, uploadDemoAction } from "@/app/actions/organizer";
import {
  addPlayerToTeamAction,
  buildBracketAction,
  createTeamAction,
  deleteTeamAction,
  drawGroupsAction,
  removePlayerFromTeamAction,
  setCaptainAction,
} from "@/app/actions/tournament";
import { AddPlayerForm } from "@/components/OrganizerForms";
import DemoUploadForm, { type SeriesOption } from "@/components/DemoUploadForm";

export const dynamic = "force-dynamic";

const stageLabel: Record<Series["stage"], string> = {
  group: "Группы",
  semifinal: "Полуфинал",
  final: "Финал",
};

export default async function ManageTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournamentId = Number(id);
  if (!Number.isFinite(tournamentId)) notFound();

  const profile = await requireOrganizer();
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournamentId)
    .eq("created_by", profile.id)
    .single();
  if (!tournament) redirect("/organizer");

  /* ============ ФОРМАТ «6 КОМАНД» ============ */
  if (tournament.format === "teams_6x5") {
    return <TeamFormatView tournamentId={tournamentId} />;
  }

  /* ============ Простой режим (как раньше) ============ */
  return <SimpleModeView tournamentId={tournamentId} />;
}

/* ================= Режим: простой (без формата) ================= */

async function SimpleModeView({ tournamentId }: { tournamentId: number }) {
  const supabase = await createClient();
  const [{ data: tournament }, { data: participants }, { data: matches }, { data: maps }] =
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
      supabase.from("maps").select("id, name").order("name"),
    ]);
  if (!tournament) return null;

  return (
    <section className="flex flex-col gap-6">
      <div className="card">
        <h1 className="text-3xl font-bold">{tournament.name}</h1>
        <p className="mt-1 text-sm text-slate-400">Управление турниром</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold text-orange-400">Загрузка демки Fastcup</h2>
        <div className="mt-3">
          <DemoUploadForm
            action={uploadDemoAction}
            tournamentId={tournamentId}
            mapOptions={maps ?? []}
          />
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-lg font-bold text-orange-400">
          Участники ({participants?.length ?? 0})
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {participants?.map((p) => {
            const player = p.players as unknown as { id: number; nickname: string } | null;
            if (!player) return null;
            return (
              <li key={player.id} className="flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1">
                <Link href={`/players/${player.id}`} className="text-sm hover:text-orange-400">
                  {player.nickname}
                </Link>
                <form action={removePlayerAction}>
                  <input type="hidden" name="tournament_id" value={tournamentId} />
                  <input type="hidden" name="player_id" value={player.id} />
                  <button className="text-xs text-red-400 hover:text-red-300">✕</button>
                </form>
              </li>
            );
          })}
        </ul>
        <AddPlayerForm action={addPlayerAction} tournamentId={tournamentId} />
      </div>

      <div className="card">
        <h2 className="mb-3 text-lg font-bold text-orange-400">Матчи ({matches?.length ?? 0})</h2>
        <p className="text-sm text-slate-500">Список карт — см. публичную страницу турнира</p>
      </div>

      <div>
        <Link href={`/tournaments/${tournamentId}`} className="btn-secondary">
          Публичная страница турнира
        </Link>
      </div>
    </section>
  );
}

/* ================= Режим: 6 команд × 5 игроков ================= */

async function TeamFormatView({ tournamentId }: { tournamentId: number }) {
  const supabase = await createClient();

  const [
    { data: tournament },
    { data: teams },
    { data: series },
    { data: matches },
    { data: maps },
  ] = await Promise.all([
    supabase.from("tournaments").select("*").eq("id", tournamentId).single(),
    supabase
      .from("teams")
      .select("*, team_players(is_captain, players(id, nickname))")
      .eq("tournament_id", tournamentId)
      .order("name"),
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
    supabase.from("maps").select("id, name").order("name"),
  ]);
  if (!tournament) return null;

  const teamsTyped = (teams ?? []) as unknown as (Team & {
    team_players: { is_captain: boolean; players: { id: number; nickname: string } | null }[];
  })[];
  const seriesTyped = (series ?? []) as Series[];
  const matchesTyped = (matches ?? []) as unknown as (MatchRow & { maps: { name: string } | null })[];

  const hasDraw = seriesTyped.length > 0;
  const playerCounts = new Map<number, number>();
  for (const t of teamsTyped) {
    playerCounts.set(t.id, (t.team_players ?? []).length);
  }
  const ready = rostersComplete(teamsTyped, playerCounts);

  // серии со ссылками на команды
  const teamName = (id: number | null) =>
    teamsTyped.find((t) => t.id === id)?.name ?? "—";

  const seriesLabel = (s: Series) => {
    const names = `${stageLabel[s.stage]}`;
    const pair = `${teamName(s.team1_id)} vs ${teamName(s.team2_id)}`;
    return `${names}: ${pair}`;
  };

  const unfinishedSeries = seriesTyped.filter((s) => s.status !== "finished" && s.team1_id && s.team2_id);
  const seriesOptions: SeriesOption[] = unfinishedSeries.map((s) => ({
    id: s.id,
    label: `${seriesLabel(s)} · ${s.team1_wins}:${s.team2_wins}`,
    team1Id: s.team1_id!,
    team2Id: s.team2_id!,
  }));

  const teamOptions = teamsTyped.map((t) => ({
    id: t.id,
    name: t.name,
    group: t.group_name ?? "A",
  }));

  const byStage = (stage: Series["stage"], group?: string) =>
    seriesTyped.filter((s) => s.stage === stage && (group == null || s.group_name === group));

  const renderSeriesList = (items: Series[]) => (
    <ul className="divide-y divide-slate-800">
      {items.map((s) => {
        const mapsOfSeries = matchesTyped.filter((m) => m.series_id === s.id);
        const done = s.status === "finished";
        const winner = done ? (s.team1_wins > s.team2_wins ? s.team1_id : s.team2_id) : null;
        return (
          <li key={s.id} className="py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-200">
                {teamName(s.team1_id)} <span className={done ? "text-green-400" : "text-slate-400"}>
                  {s.team1_wins}</span>
                {" : "}
                <span className={done ? "text-green-400" : "text-slate-400"}>{s.team2_wins}</span>{" "}
                {teamName(s.team2_id)}
                {winner != null && (
                  <span className="ml-2 text-xs text-slate-500">
                    → дальше: {teamName(winner)}
                  </span>
                )}
              </span>
              <span className={`badge ${done ? "bg-green-500/15 text-green-400" : s.status === "live" ? "bg-blue-500/15 text-blue-400" : "bg-slate-500/20 text-slate-400"}`}>
                {done ? "завершена" : s.status === "live" ? "идёт" : "ожидается"}
              </span>
            </div>
            {mapsOfSeries.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs text-slate-400">
                {mapsOfSeries.map((m) => {
              const t1WinsMap = m.team1_score > m.team2_score;
              return (
                <li key={m.id}>
                  карта {m.maps?.name ?? "—"}:{" "}
                  {t1WinsMap ? m.team1_score : m.team2_score}
                  {" : "}
                  {t1WinsMap ? m.team2_score : m.team1_score}{" "}
                  → {teamName(t1WinsMap ? m.match_team1_id : m.match_team2_id)}
                </li>
              );
            })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="card">
        <h1 className="text-3xl font-bold">{tournament.name}</h1>
        <p className="mt-1 text-sm text-slate-400">
          Формат: 6 команд × 5 игроков · группы + сетка · всё Bo3
        </p>
      </div>

      {/* ---------- Составы ---------- */}
      <div className="card">
        <h2 className="text-lg font-bold text-orange-400">Команды и составы</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {teamsTyped.map((t) => (
            <div key={t.id} className="rounded-lg border border-slate-800 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">
                  {t.name}
                  {t.group_name && (
                    <span className="badge ml-2 bg-blue-500/15 text-blue-400">группа {t.group_name}</span>
                  )}
                </h3>
                {!hasDraw && (
                  <form action={deleteTeamAction}>
                    <input type="hidden" name="tournament_id" value={tournamentId} />
                    <input type="hidden" name="team_id" value={t.id} />
                    <button className="text-xs text-red-400 hover:text-red-300">удалить</button>
                  </form>
                )}
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {(t.team_players ?? []).map((tp) => {
                  const p = tp.players;
                  if (!p) return null;
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <span>
                        {tp.is_captain && <span className="text-amber-400" title="Капитан">★</span>}{" "}
                        <Link href={`/players/${p.id}`} className="hover:text-orange-400">{p.nickname}</Link>
                      </span>
                      {!hasDraw && (
                        <span className="flex gap-2 text-xs">
                          {!tp.is_captain && (
                            <form action={setCaptainAction}>
                              <input type="hidden" name="tournament_id" value={tournamentId} />
                              <input type="hidden" name="team_id" value={t.id} />
                              <input type="hidden" name="player_id" value={p.id} />
                              <button className="text-slate-400 hover:text-amber-400">сделать капитаном</button>
                            </form>
                          )}
                          <form action={removePlayerFromTeamAction}>
                            <input type="hidden" name="tournament_id" value={tournamentId} />
                            <input type="hidden" name="team_id" value={t.id} />
                            <input type="hidden" name="player_id" value={p.id} />
                            <button className="text-red-400 hover:text-red-300">✕</button>
                          </form>
                        </span>
                      )}
                    </li>
                  );
                })}
                {(t.team_players ?? []).length === 0 && (
                  <li className="text-slate-500">пока пусто</li>
                )}
              </ul>
              {!hasDraw && (
                <form action={addPlayerToTeamAction} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="tournament_id" value={tournamentId} />
                  <input type="hidden" name="team_id" value={t.id} />
                  <input name="nickname" className="input max-w-[220px]" placeholder="Никнейм игрока" required />
                  <label className="flex items-center gap-1 text-xs text-slate-400">
                    <input type="checkbox" name="captain" className="size-4 accent-orange-500" />
                    капитан
                  </label>
                  <button className="btn-secondary px-3 py-1 text-xs">+ добавить</button>
                </form>
              )}
            </div>
          ))}
          {!hasDraw && teamsTyped.length < 6 && (
            <form action={createTeamAction} className="card flex flex-col items-start gap-2 md:col-span-2">
              <input type="hidden" name="tournament_id" value={tournamentId} />
              <div className="flex w-full max-w-md gap-2">
                <input name="name" className="input" placeholder="Название новой команды" required />
                <button className="btn whitespace-nowrap">+ создать команду</button>
              </div>
              <p className="text-xs text-slate-500">
                Создайте 6 команд и добавьте в каждую ровно 5 игроков (один — капитан).
              </p>
            </form>
          )}
        </div>

        {/* ---------- Жеребьёвка / повторная ---------- */}
        {!hasDraw && (
          <form action={drawGroupsAction} className="mt-6">
            <input type="hidden" name="tournament_id" value={tournamentId} />
            <button className="btn" disabled={!ready.ok} title={ready.reason ?? ""}>
              🎲 Провести жеребьёвку (группы A/B)
            </button>
            {!ready.ok && (
              <p className="mt-2 text-sm text-yellow-400">{ready.reason}</p>
            )}
          </form>
        )}
      </div>

      {/* ---------- Группы ---------- */}
      {hasDraw && (() => {
        const standings = computeStandings(
          teamsTyped,
          seriesTyped,
          matchesTyped,
        );
        const groupsDone =
          byStage("group").length === 6 && byStage("group").every((s) => s.status === "finished");
        const semis = byStage("semifinal");
        const finalSeries = byStage("final");

        return (
          <>
            {(["A", "B"] as const).map((letter) => (
              <div key={letter} className="card">
                <h2 className="text-lg font-bold text-orange-400">Группа {letter}</h2>
                <table className="mt-3 w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-left text-slate-400">
                      <th className="py-2">Команда</th>
                      <th className="py-2">Игр</th>
                      <th className="py-2">W–L</th>
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
                <div className="mt-4">{renderSeriesList(byStage("group", letter))}</div>
              </div>
            ))}

            {/* ---------- Сетка ---------- */}
            <div className="card">
              <h2 className="text-lg font-bold text-orange-400">Плей-офф сетка</h2>
              {semis.length === 0 ? (
                <div className="mt-3">
                  <p className="text-sm text-slate-400">
                    {groupsDone
                      ? "Группы завершены — сформируйте сетку вручную (или она построится автоматически после следующей загрузки демки)."
                      : "Сетка появится, когда завершатся все групповые серии."}
                  </p>
                  {groupsDone && (
                    <form action={buildBracketAction} className="mt-3">
                      <input type="hidden" name="tournament_id" value={tournamentId} />
                      <button className="btn">Строить сетку: A1–B2, B1–A2</button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="mt-3 grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="mb-1 text-sm font-bold text-slate-300">Полуфиналы</h3>
                    {renderSeriesList(semis)}
                  </div>
                  <div>
                    <h3 className="mb-1 text-sm font-bold text-slate-300">Финал</h3>
                    {finalSeries.length > 0
                      ? renderSeriesList(finalSeries)
                      : <p className="text-sm text-slate-500">Появится после полуфиналов</p>}
                    {finalSeries.some((s) => s.status === "finished") && (
                      <p className="mt-2 text-green-400">
                        🏆 Победитель турнира:{" "}
                        <b>{teamName(finalSeries[0].team1_wins > finalSeries[0].team2_wins ? finalSeries[0].team1_id : finalSeries[0].team2_id)}</b>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ---------- Загрузка демки ---------- */}
            <div className="card">
              <h2 className="text-lg font-bold text-orange-400">Загрузка демки Fastcup</h2>
              {seriesOptions.length > 0 ? (
                <div className="mt-3">
                  <DemoUploadForm
                    action={uploadDemoAction}
                    tournamentId={tournamentId}
                    mapOptions={maps ?? []}
                    seriesOptions={seriesOptions}
                    teamOptions={teamOptions}
                  />
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-400">
                  Все серии сыграны — демок больше не требуется.
                </p>
              )}
            </div>
          </>
        );
      })()}

      <div>
        <Link href={`/tournaments/${tournamentId}`} className="btn-secondary">
          Публичная страница турнира
        </Link>
      </div>
    </section>
  );
}
