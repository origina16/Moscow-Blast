import type { MatchRow, Series, Team } from "./types";

/** Строка турнирной таблицы группы. */
export interface Standing {
  teamId: number;
  teamName: string;
  played: number;   // сыгранных серий (Bo3)
  seriesWins: number;
  seriesLosses: number;
  mapWins: number;
  mapLosses: number;
}

const empty = (t: Team): Standing => ({
  teamId: t.id,
  teamName: t.name,
  played: 0,
  seriesWins: 0,
  seriesLosses: 0,
  mapWins: 0,
  mapLosses: 0,
});

/** Разница карт (тай-брейк стендов). */
const mapDiff = (s: Standing) => s.mapWins - s.mapLosses;

/** Сортировка стендов: победы в сериях по убыванию, затем разница карт. */
export function sortStandings(rows: Standing[]): Standing[] {
  return [...rows].sort(
    (a, b) =>
      b.seriesWins - a.seriesWins ||
      mapDiff(b) - mapDiff(a) ||
      b.mapWins - a.mapWins ||
      a.teamName.localeCompare(b.teamName, "ru"),
  );
}

/**
 * Считает стенды групп A/B из завершённых серий и сыгранных карт (демок).
 * Присылаемые matches — все матчи турнира; групповые берутся через серию.
 */
export function computeStandings(
  teams: Team[],
  series: Series[],
  matches: MatchRow[],
): { A: Standing[]; B: Standing[] } {
  const byId = new Map(teams.map((t) => [t.id, empty(t)]));
  const groupOf = new Map(teams.map((t) => [t.id, t.group_name]));

  // Победы в сериях
  for (const s of series) {
    if (s.stage !== "group" || s.status !== "finished") continue;
    if (!s.team1_id || !s.team2_id) continue;
    const winner = s.team1_wins > s.team2_wins ? s.team1_id : s.team2_id;
    const loser = winner === s.team1_id ? s.team2_id : s.team1_id;
    const w = byId.get(winner);
    const l = byId.get(loser);
    if (w) { w.seriesWins++; w.played++; }
    if (l) { l.seriesLosses++; l.played++; }
  }

  // Победы по картам (каждая сыгранная демка = карта)
  for (const m of matches) {
    if (!m.series_id || !m.match_team1_id || !m.match_team2_id) continue;
    const t1 = byId.get(m.match_team1_id);
    const t2 = byId.get(m.match_team2_id);
    if (!t1 || !t2) continue;
    if (m.team1_score > m.team2_score) { t1.mapWins++; t2.mapLosses++; }
    else if (m.team2_score > m.team1_score) { t2.mapWins++; t1.mapLosses++; }
  }

  const pick = (letter: string) =>
    sortStandings(teams.filter((t) => groupOf.get(t.id) === letter).map((t) => byId.get(t.id)!));

  return { A: pick("A"), B: pick("B") };
}

/**
 * Формат готов к жеребьёвке: ровно 6 команд, в каждой 5 игроков.
 */
export function rostersComplete(
  teams: Team[],
  playersPerTeam: Map<number, number>,
  needed = 6,
): { ok: boolean; reason?: string } {
  if (teams.length < needed) {
    return { ok: false, reason: `Нужно ${needed} команд, сейчас ${teams.length}` };
  }
  for (const t of teams) {
    const count = playersPerTeam.get(t.id) ?? 0;
    if (count < 5) {
      return { ok: false, reason: `В команде «${t.name}» меньше 5 игроков (${count})` };
    }
  }
  return { ok: true };
}

/** Победитель серии (нужен статус finished и разница побед). */
export function seriesWinnerId(s: Series): number | null {
  if (s.team1_wins === s.team2_wins) return null;
  return s.team1_wins > s.team2_wins ? s.team1_id : s.team2_id;
}
