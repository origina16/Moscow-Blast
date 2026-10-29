"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchRow, Series, Team } from "@/lib/types";

type AdminClient = SupabaseClient;

/* --------- Валидация состава перед жеребьёвкой --------- */

async function countPlayers(
  admin: AdminClient,
  tournamentId: number,
): Promise<Map<number, number>> {
  const { data } = await admin
    .from("teams")
    .select("id, team_players(player_id)")
    .eq("tournament_id", tournamentId);
  const counts = new Map<number, number>();
  for (const t of data ?? []) {
    counts.set(t.id, Array.isArray(t.team_players) ? t.team_players.length : 0);
  }
  return counts;
}

/** Проверяет, что турнир принадлежит текущему организатору. */
async function owned(admin: AdminClient, tournamentId: number) {
  const profile = await requireOrganizer();
  const { data } = await admin
    .from("tournaments")
    .select("id")
    .eq("id", tournamentId)
    .eq("created_by", profile.id)
    .single();
  return data != null;
}

function ok(tid: number, pagePath: string) {
  revalidatePath(pagePath, "layout");
  revalidatePath("/players");
}

/* ------------------------- Команды ------------------------- */

export async function createTeamAction(formData: FormData) {
  const tournamentId = Number(formData.get("tournament_id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!Number.isFinite(tournamentId) || name.length < 1) return;
  if (!(await owned(createAdminClient(), tournamentId))) return;

  const admin = createAdminClient();
  const { data: teams } = await admin
    .from("teams")
    .select("id")
    .eq("tournament_id", tournamentId);

  if (!teams || teams.length >= 6) return;
  await admin.from("teams").insert({ tournament_id: tournamentId, name });
  ok(tournamentId, `/organizer/tournaments/${tournamentId}`);
}

export async function deleteTeamAction(formData: FormData) {
  const tournamentId = Number(formData.get("tournament_id"));
  const teamId = Number(formData.get("team_id"));
  const admin = createAdminClient();
  if (!Number.isFinite(tournamentId) || !Number.isFinite(teamId)) return;
  if (!(await owned(admin, tournamentId))) return;

  // Запрещаем удалять команду, за которую сыграны матчи
  const { data: played } = await admin
    .from("matches")
    .select("id")
    .or(`match_team1_id.eq.${teamId},match_team2_id.eq.${teamId}`)
    .limit(1);
  if (played?.length) return;

  await admin.from("teams").delete().eq("id", teamId).eq("tournament_id", tournamentId);
  ok(tournamentId, `/organizer/tournaments/${tournamentId}`);
}

/* ---------------------- Составы команд ---------------------- */

export async function addPlayerToTeamAction(formData: FormData) {
  const tournamentId = Number(formData.get("tournament_id"));
  const teamId = Number(formData.get("team_id"));
  const nickname = String(formData.get("nickname") ?? "").trim();
  const asCaptain = formData.get("captain") === "on";
  const admin = createAdminClient();
  if (!admin || !Number.isFinite(tournamentId) || !Number.isFinite(teamId) || !nickname) return;
  if (!(await owned(admin, tournamentId))) return;

  const { data: team } = await admin
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .eq("tournament_id", tournamentId)
    .single();
  if (!team) return;

  const { count } = await admin
    .from("team_players")
    .select("player_id", { count: "exact", head: true })
    .eq("team_id", teamId);
  if ((count ?? 0) >= 5) return;

  const { data: player } = await admin
    .from("players")
    .select("id")
    .ilike("nickname", nickname)
    .maybeSingle();

  let playerId = player?.id;
  if (!playerId) {
    const { data: created } = await admin
      .from("players")
      .insert({ nickname })
      .select("id")
      .single();
    if (!created) return;
    playerId = created.id;
  }

  if (asCaptain) {
    await admin.from("team_players").update({ is_captain: false }).eq("team_id", teamId);
  }
  await admin
    .from("team_players")
    .upsert({ team_id: teamId, player_id: playerId, is_captain: asCaptain });
  ok(tournamentId, `/organizer/tournaments/${tournamentId}`);
}

export async function removePlayerFromTeamAction(formData: FormData) {
  const tournamentId = Number(formData.get("tournament_id"));
  const teamId = Number(formData.get("team_id"));
  const playerId = Number(formData.get("player_id"));
  const admin = createAdminClient();
  if (!Number.isFinite(tournamentId) || !Number.isFinite(teamId) || !Number.isFinite(playerId)) return;
  if (!(await owned(admin, tournamentId))) return;

  await admin
    .from("team_players")
    .delete()
    .eq("team_id", teamId)
    .eq("player_id", playerId);
  ok(tournamentId, `/organizer/tournaments/${tournamentId}`);
}

export async function setCaptainAction(formData: FormData) {
  const tournamentId = Number(formData.get("tournament_id"));
  const teamId = Number(formData.get("team_id"));
  const playerId = Number(formData.get("player_id"));
  const admin = createAdminClient();
  if (!Number.isFinite(tournamentId) || !Number.isFinite(teamId) || !Number.isFinite(playerId)) return;
  if (!(await owned(admin, tournamentId))) return;

  await admin.from("team_players").update({ is_captain: false }).eq("team_id", teamId);
  await admin
    .from("team_players")
    .update({ is_captain: true })
    .eq("team_id", teamId)
    .eq("player_id", playerId);
  ok(tournamentId, `/organizer/tournaments/${tournamentId}`);
}

/* ------------------------- Жеребьёвка ------------------------- */

export async function drawGroupsAction(formData: FormData) {
  const tournamentId = Number(formData.get("tournament_id"));
  const admin = createAdminClient();
  if (!Number.isFinite(tournamentId)) return;
  if (!(await owned(admin, tournamentId))) return;

  const { data: teams } = await admin
    .from("teams")
    .select("*")
    .eq("tournament_id", tournamentId);
  if (!teams || teams.length !== 6) return;

  // Каждый раз — только свежая жеребьёвка
  const { data: existingSeries } = await admin
    .from("series")
    .select("id")
    .eq("tournament_id", tournamentId)
    .limit(1);
  if (existingSeries?.length) return;

  const playerCounts = await countPlayers(admin, tournamentId);
  for (const t of teams) {
    if ((playerCounts.get(t.id) ?? 0) < 5) return;
    if ((playerCounts.get(t.id) ?? 0) > 5) return; // строго 5 в формате
  }

  // Случайное распределение: 3 команды в группу A, 3 — в B
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const groups = { A: shuffled.slice(0, 3), B: shuffled.slice(3, 6) };

  for (const [letter, groupTeams] of Object.entries(groups)) {
    for (const t of groupTeams) {
      await admin.from("teams").update({ group_name: letter }).eq("id", t.id);
    }
    const [a, b, c] = groupTeams as Team[];
    await admin.from("series").insert([
      { tournament_id: tournamentId, stage: "group", round: 1, group_name: letter, team1_id: a.id, team2_id: b.id },
      { tournament_id: tournamentId, stage: "group", round: 2, group_name: letter, team1_id: a.id, team2_id: c.id },
      { tournament_id: tournamentId, stage: "group", round: 3, group_name: letter, team1_id: b.id, team2_id: c.id },
    ]);
  }

  ok(tournamentId, `/organizer/tournaments/${tournamentId}`);
}

/* --------------------------- Сетка --------------------------- */

/** Создаёт полуфиналы из стендов групп (если группы завершены). */
export async function buildBracketAction(formData: FormData) {
  const tournamentId = Number(formData.get("tournament_id"));
  const admin = createAdminClient();
  if (!Number.isFinite(tournamentId)) return;
  if (!(await owned(admin, tournamentId))) return;

  const { data: groupSeries } = await admin
    .from("series")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("stage", "group");
  if (!groupSeries || groupSeries.length !== 6) return;
  if (groupSeries.some((s: Series) => s.status !== "finished")) return;

  const { data: semis } = await admin
    .from("series")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("stage", "semifinal")
    .limit(1);
  if (semis?.length) return;

  await buildBracketInternal(admin, tournamentId);
  ok(tournamentId, `/organizer/tournaments/${tournamentId}`);
}

/** Продвигает сетку: создаёт полуфиналы/финал, закрывает турнир. Вызывается после каждой загрузки демки. */
export async function ensureBracketProgress(admin: AdminClient, tournamentId: number) {
  // 1. Все 6 групповых серий сыграны, сетки ещё нет → строим
  const { data: groupSeries } = await admin
    .from("series")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("stage", "group");
  if (
    groupSeries &&
    groupSeries.length === 6 &&
    groupSeries.every((s: Series) => s.status === "finished")
  ) {
    const { data: semis } = await admin
      .from("series")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("stage", "semifinal")
      .limit(1);
    if (!semis?.length) await buildBracketInternal(admin, tournamentId);
  }

  // 2. Оба полуфинала завершены, финала нет → создаём финал
  const { data: semifinalList } = await admin
    .from("series")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("stage", "semifinal");
  const { data: finals } = await admin
    .from("series")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("stage", "final");

  if (semifinalList && semifinalList.length === 2 && finals?.length === 0) {
    if (semifinalList.every((s: Series) => s.status === "finished")) {
      const winners = semifinalList
        .map((s: Series) => (s.team1_wins > s.team2_wins ? s.team1_id : s.team2_id))
        .filter((x): x is number => x != null);
      if (winners.length === 2) {
        await admin.from("series").insert({
          tournament_id: tournamentId,
          stage: "final",
          round: 2,
          team1_id: winners[0],
          team2_id: winners[1],
          status: "upcoming",
        });
      }
    }
  }

  // 3. Финал завершён → турнир завершён
  if (finals?.length === 1) {
    const final = finals[0] as Series;
    if (final.status === "finished") {
      await admin
        .from("tournaments")
        .update({ status: "finished" })
        .eq("id", tournamentId);
    }
  }

  ok(tournamentId, `/organizer/tournaments/${tournamentId}`);
}

/** Внутренняя: строит сетку из стендов групп. */
async function buildBracketInternal(admin: AdminClient, tournamentId: number) {
  const { data: teams } = await admin
    .from("teams")
    .select("*")
    .eq("tournament_id", tournamentId);
  const { data: matches } = await admin
    .from("matches")
    .select("*")
    .eq("tournament_id", tournamentId);
  const { data: series } = await admin
    .from("series")
    .select("*")
    .eq("tournament_id", tournamentId);
  if (!teams || !series) return;

  const { computeStandings } = await import("@/lib/bracket");
  const standings = computeStandings(
    teams as Team[],
    series as Series[],
    (matches ?? []) as MatchRow[],
  );

  const a1 = standings.A[0], a2 = standings.A[1];
  const b1 = standings.B[0], b2 = standings.B[1];
  if (!a1 || !a2 || !b1 || !b2) return;

  await admin.from("series").insert([
    { tournament_id: tournamentId, stage: "semifinal", round: 1, team1_id: a1.teamId, team2_id: b2.teamId },
    { tournament_id: tournamentId, stage: "semifinal", round: 1, team1_id: b1.teamId, team2_id: a2.teamId },
  ]);
}
