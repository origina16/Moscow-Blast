"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseDemoBuffer } from "@/lib/parser/demo";

export type ActionState = { error?: string; message?: string } | null;

/* ------------------------- Турниры ------------------------- */

export async function createTournamentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireOrganizer();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const startsAtRaw = String(formData.get("starts_at") ?? "").trim();

  if (name.length < 3) return { error: "Название минимум 3 символа" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tournaments")
    .insert({
      name,
      description: description || null,
      starts_at: startsAtRaw ? new Date(startsAtRaw).toISOString() : null,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "Не удалось создать турнир" };

  revalidatePath("/tournaments");
  revalidatePath("/organizer");
  redirect(`/organizer/tournaments/${data.id}`);
}

/* ------------------------- Участники ------------------------- */

export async function addPlayerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireOrganizer();
  const tournamentId = Number(formData.get("tournament_id"));
  const nickname = String(formData.get("nickname") ?? "").trim();

  if (!Number.isFinite(tournamentId) || !nickname) {
    return { error: "Укажите никнейм игрока" };
  }

  const admin = createAdminClient();
  const { data: owned } = await admin
    .from("tournaments")
    .select("id")
    .eq("id", tournamentId)
    .eq("created_by", profile.id)
    .single();
  if (!owned) return { error: "Турнир не найден" };

  // игрок ищется по нику (регистронезависимо), при отсутствии — создаётся
  const { data: player } = await admin
    .from("players")
    .select("id")
    .ilike("nickname", nickname)
    .maybeSingle();

  let playerId = player?.id;
  if (!playerId) {
    const { data: created, error } = await admin
      .from("players")
      .insert({ nickname })
      .select("id")
      .single();
    if (error || !created) return { error: "Не удалось создать игрока" };
    playerId = created.id;
  }

  await admin
    .from("tournament_players")
    .upsert({ tournament_id: tournamentId, player_id: playerId });

  revalidatePath(`/organizer/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath("/players");
  return { message: `Игрок «${nickname}» добавлен в турнир` };
}

export async function removePlayerAction(formData: FormData) {
  const profile = await requireOrganizer();
  const tournamentId = Number(formData.get("tournament_id"));
  const playerId = Number(formData.get("player_id"));
  if (!Number.isFinite(tournamentId) || !Number.isFinite(playerId)) return;

  const admin = createAdminClient();
  const { data: owned } = await admin
    .from("tournaments")
    .select("id")
    .eq("id", tournamentId)
    .eq("created_by", profile.id)
    .single();
  if (!owned) return;

  await admin
    .from("tournament_players")
    .delete()
    .eq("tournament_id", tournamentId)
    .eq("player_id", playerId);

  revalidatePath(`/organizer/tournaments/${tournamentId}`);
}

/* ------------------------- Демки ------------------------- */

export async function uploadDemoAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireOrganizer();
  const tournamentId = Number(formData.get("tournament_id"));
  const file = formData.get("demo") as File | null;
  const team1Name = String(formData.get("team1_name") ?? "").trim() || "Team 1";
  const team2Name = String(formData.get("team2_name") ?? "").trim() || "Team 2";
  const selectedMapId = Number(formData.get("map_id")) || null;

  if (!Number.isFinite(tournamentId)) return { error: "Некорректный турнир" };
  if (!file || file.size === 0) return { error: "Выберите файл демки (.dem)" };

  const admin = createAdminClient();
  const { data: owned } = await admin
    .from("tournaments")
    .select("id")
    .eq("id", tournamentId)
    .eq("created_by", profile.id)
    .single();
  if (!owned) return { error: "Турнир не найден" };

  // 1. Разбираем демку
  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = await parseDemoBuffer(buffer);
  } catch (e) {
    return { error: `Ошибка парсинга демки: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (parsed.players.length === 0) {
    return { error: "Демка разобрана, но статистики игроков не найдено. Формат может не поддерживаться (нужна GOTV-демка Fastcup)." };
  }

  // 2. Определяем карту
  let mapId: number | null = null;
  if (parsed.mapName) {
    const { data: mapRow } = await admin
      .from("maps")
      .select("id")
      .ilike("name", `%${parsed.mapName}%`)
      .maybeSingle();
    if (mapRow) mapId = mapRow.id;
    else {
      const { data: created } = await admin
        .from("maps")
        .insert({ name: parsed.mapName })
        .select("id")
        .single();
      mapId = created?.id ?? null;
    }
  }
  if (!mapId && selectedMapId) mapId = selectedMapId;

  // 3. Загружаем файл в Storage
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const demoPath = `tournament-${tournamentId}/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from("demos")
    .upload(demoPath, buffer, { contentType: "application/octet-stream" });
  if (uploadError) return { error: `Ошибка сохранения файла: ${uploadError.message}` };

  // 4. Регистрируем матч
  const { data: match, error: matchError } = await admin
    .from("matches")
    .insert({
      tournament_id: tournamentId,
      map_id: mapId,
      team1_name: team1Name,
      team2_name: team2Name,
      team1_score: parsed.team1Score,
      team2_score: parsed.team2Score,
      demo_path: demoPath,
      parsed: true,
    })
    .select("id")
    .single();

  if (matchError || !match) {
    await admin.storage.from("demos").remove([demoPath]);
    return { error: `Ошибка сохранения матча: ${matchError?.message ?? "нет данных"}` };
  }

  // 5. Привязываем игроков и пишем статистику
  let added = 0;
  for (const ps of parsed.players) {
    const nickname = ps.nickname || "Неизвестный игрок";
    const { data: player } = await admin
      .from("players")
      .select("id")
      .ilike("nickname", nickname)
      .maybeSingle();

    let playerId = player?.id;
    if (!playerId) {
      const { data: created, error: insertErr } = await admin
        .from("players")
        .insert({ nickname })
        .select("id")
        .single();
      if (insertErr || !created) continue;
      playerId = created.id;
    }

    await admin
      .from("tournament_players")
      .upsert({ tournament_id: tournamentId, player_id: playerId });

    const { error: statErr } = await admin.from("player_match_stats").insert({
      match_id: match.id,
      player_id: playerId,
      team: ps.team,
      kills: ps.kills,
      deaths: ps.deaths,
      assists: ps.assists,
      hs_kills: ps.hsKills,
      damage: ps.damage,
      rounds_played: parsed.roundsPlayed,
    });
    if (!statErr) added++;
  }

  revalidatePath(`/organizer/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath("/players");

  return {
    message: `Демка разобрана: ${parsed.team1Score}:${parsed.team2Score}, карта ${parsed.mapName ?? "—"}, статистика записана для ${added} игроков`,
  };
}
