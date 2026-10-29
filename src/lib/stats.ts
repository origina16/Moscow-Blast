import type { PlayerAverages, PlayerMatchStatsRow } from "@/lib/types";

/** Округление до 0.1 */
export const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Считает средние значения по списку статистик матчей игрока.
 * ADR = суммарный урон / суммарные раунды; HS% = hs_kills / kills.
 */
export function computeAverages(rows: PlayerMatchStatsRow[]): PlayerAverages {
  if (rows.length === 0) {
    return {
      games: 0, kills: 0, deaths: 0, assists: 0, adr: 0,
      hsPercent: 0, kd: 0, totalDamage: 0,
    };
  }

  const sum = rows.reduce(
    (a, r) => {
      a.kills += r.kills;
      a.deaths += r.deaths;
      a.assists += r.assists;
      a.hsKills += r.hs_kills;
      a.damage += r.damage;
      a.rounds += r.rounds_played;
      return a;
    },
    { kills: 0, deaths: 0, assists: 0, hsKills: 0, damage: 0, rounds: 0 },
  );

  const killAvg = sum.kills / rows.length;
  const deathAvg = sum.deaths / rows.length;

  return {
    games: rows.length,
    kills: round1(killAvg),
    deaths: round1(deathAvg),
    assists: round1(sum.assists / rows.length),
    adr: sum.rounds > 0 ? round1(sum.damage / sum.rounds) : 0,
    hsPercent: sum.kills > 0 ? Math.round((sum.hsKills / sum.kills) * 100) : 0,
    kd: deathAvg > 0 ? round1(killAvg / deathAvg) : killAvg,
    totalDamage: sum.damage,
  };
}

/** Простой "рейтинг" игрока (0–10) из средних показателей — для сортировки/визуализации. */
export function ratingScore(a: PlayerAverages): number {
  if (a.games === 0) return 0;
  const score =
    (a.kills - a.deaths) * 0.3 +
    a.assists * 0.1 +
    a.adr * 0.04 +
    a.hsPercent * 0.01;
  return Math.max(0, round1(score + 5));
}
