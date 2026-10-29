import type { DemoFile } from "demofile";

/**
 * Парсер демок CS2/CS:GO (.dem) на базе библиотеки demofile.
 * Работает на Node.js (Server Actions / API routes), принимает демку как Buffer.
 *
 * Возвращает сводную статистику по каждому игроку на сервере.
 */

export interface ParsedPlayerStat {
  steamId: string | null;
  nickname: string;
  team: 1 | 2; // 1 = команда, стартовавшая за T; 2 = стартовавшая за CT
  kills: number;
  deaths: number;
  assists: number;
  hsKills: number;
  damage: number;
}

export interface ParsedDemo {
  mapName: string | null;
  team1Score: number;
  team2Score: number;
  roundsPlayed: number;
  players: ParsedPlayerStat[];
}

interface RawStat {
  steamId: string | null;
  nickname: string;
  team: 1 | 2 | null;
  kills: number;
  deaths: number;
  assists: number;
  hsKills: number;
  damage: number;
}

/** Превращает ArrayBuffer/Uint8Array из File в Node Buffer. */
export function toBuffer(data: ArrayBuffer): Buffer {
  return Buffer.from(data);
}

export async function parseDemoBuffer(buffer: Buffer): Promise<ParsedDemo> {
  const { DemoFile } = await import("demofile");
  const demo = new DemoFile();

  // userid сервера -> статистика
  const byUserId = new Map<number, RawStat>();
  // sidebar: в начале матча team1 = сторона T (2), team2 = сторона CT (3)
  let sideOfTeam1 = 2;
  // "Экземплярный" игрок team1 (для отслеживания смены сторон между пистолетами)
  let team1SampleUserId: number | null = null;
  let team1Score = 0;
  let team2Score = 0;

  const getStat = (userid: number): RawStat => {
    let s = byUserId.get(userid);
    if (!s) {
      s = {
        steamId: null,
        nickname: `userid_${userid}`,
        team: null,
        kills: 0,
        deaths: 0,
        assists: 0,
        hsKills: 0,
        damage: 0,
      };
      byUserId.set(userid, s);
    }
    return s;
  };

  /** Пытается привязать userid к entity: имя, steamid, команда. */
  const resolveEntity = (userid: number) => {
    const s = byUserId.get(userid);
    if (!s || (s.steamId && s.nickname !== `userid_${userid}`)) return;
    try {
      const entity = (demo.entities as unknown as {
        getByUserId?: (id: number) => unknown;
      }).getByUserId?.(userid);
      if (!entity) return;
      const e = entity as {
        name?: string;
        steam64Id?: string | null;
        steamId?: string | null;
        teamNumber?: number;
      };
      if (e.name) s.nickname = e.name;
      if (e.steam64Id) s.steamId = e.steam64Id;
      else if (e.steamId) s.steamId = e.steamId;
      if (!s.team && e.teamNumber) {
        s.team = entityTeamToPlayerTeam(e.teamNumber, sideOfTeam1);
      }
    } catch {
      // entity ещё не прислал данные — пропускаем
    }
  };

  const entityTeamToPlayerTeam = (
    entityTeam: number,
    currentSideOfTeam1: number,
  ): 1 | 2 | null => {
    if (!entityTeam || entityTeam === 1 || entityTeam === 0) return null; // unconnected / spectate
    const isT = entityTeam === 2;
    if (isT === (currentSideOfTeam1 === 2)) return 1;
    return 2;
  };

  demo.gameEvents.on("player_death", (e) => {
    if (!e.userid) return;
    const victim = getStat(e.userid);
    victim.deaths++;
    resolveEntity(e.userid);

    if (e.attacker && e.attacker !== e.userid) {
      const attacker = getStat(e.attacker);
      attacker.kills++;
      if (e.headshot) attacker.hsKills++;
      resolveEntity(e.attacker);
    }
    if (e.assister && e.assister !== e.userid && e.assister !== e.attacker) {
      getStat(e.assister).assists++;
      resolveEntity(e.assister);
    }
  });

  demo.gameEvents.on("player_hurt", (e) => {
    if (!e.attacker || !e.dmg_health) return;
    getStat(e.attacker).damage += e.dmg_health;
  });

  demo.gameEvents.on("round_start", () => {
    try {
      // В первом раунде фиксируем составы: T-сторона = team1
      const players = ((demo.entities as unknown as { players?: unknown[] }).players ?? []) as Array<{
        userId?: number;
        teamNumber?: number;
      }>;

      // обновляем "экземплярного" игрок team1, чтобы следить за сменой сторон
      for (const p of players) {
        if (p.userId == null) continue;
        const stat = byUserId.get(p.userId);
        if (stat?.team === 1) {
          if (p.teamNumber === 2 || p.teamNumber === 3) {
            sideOfTeam1 = p.teamNumber;
            resolveEntity(p.userId);
          }
          break;
        }
      }

      if (team1SampleUserId === null) {
        for (const p of players) {
          if (p.userId != null && p.teamNumber === 2) {
            team1SampleUserId = p.userId;
            const s = getStat(p.userId);
            s.team = 1;
            break;
          }
        }
        if (team1SampleUserId !== null && byUserId.get(team1SampleUserId) === undefined) {
          team1SampleUserId = null;
        }
      }
    } catch {
      // пропускаем
    }
  });

  demo.gameEvents.on("round_end", (e) => {
    if (e.winner === 2 || e.winner === 3) {
      if (e.winner === sideOfTeam1) team1Score++;
      else team2Score++;
    }
  });

  // демofile парсит буфер синхронно: события срабатывают внутри parse()
  const { parseHeader } = (await import("demofile")) as {
    parseHeader: (b: ArrayBuffer) => { mapName?: string } | null;
  };
  let mapName: string | null = null;
  try {
    mapName = parseHeader(buffer.slice(0, 2048) as unknown as ArrayBuffer)?.mapName ?? null;
  } catch {
    mapName = null;
  }
  demo.parse(buffer);

  // Финальная привязка никнеймов/steamid ко всем участникам
  try {
    const players = ((demo.entities as unknown as { players?: unknown[] }).players ?? []) as Array<{
      userId?: number;
      name?: string;
      steam64Id?: string | null;
      teamNumber?: number;
    }>;
    for (const p of players) {
      if (p.userId == null) continue;
      const s = getStat(p.userId);
      if (p.name) s.nickname = p.name;
      if (p.steam64Id) s.steamId = p.steam64Id;
      if (!s.team && p.teamNumber) s.team = entityTeamToPlayerTeam(p.teamNumber, sideOfTeam1);
    }
  } catch {
    // если движок демки не дал финальный список — оставляем собранное по событиям
  }

  const players: ParsedPlayerStat[] = [...byUserId.values()]
    .filter((s) => s.kills + s.deaths + s.damage > 0)
    .map((s) => ({
      steamId: s.steamId,
      nickname: s.nickname,
      team: s.team ?? 1,
      kills: s.kills,
      deaths: s.deaths,
      assists: s.assists,
      hsKills: s.hsKills,
      damage: s.damage,
    }));

  const roundsPlayed = team1Score + team2Score;

  return { mapName, team1Score, team2Score, roundsPlayed, players };
}
