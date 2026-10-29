import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { addPlayerAction, removePlayerAction, uploadDemoAction } from "@/app/actions/organizer";
import { AddPlayerForm } from "@/components/OrganizerForms";
import DemoUploadForm from "@/components/DemoUploadForm";

export const dynamic = "force-dynamic";

export default async function ManageTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournamentId = Number(id);
  if (!Number.isFinite(tournamentId)) notFound();

  const profile = await requireOrganizer();
  const admin = createAdminClient();

  const { data: tournament } = await admin
    .from("tournaments")
    .select("*")
    .eq("id", tournamentId)
    .eq("created_by", profile.id)
    .single();
  if (!tournament) redirect("/organizer");

  const [{ data: participants }, { data: matches }, { data: maps }] = await Promise.all([
    admin
      .from("tournament_players")
      .select("players(id, nickname)")
      .eq("tournament_id", tournamentId),
    admin
      .from("matches")
      .select("*, maps(name)")
      .eq("tournament_id", tournamentId)
      .order("played_at", { ascending: false }),
    admin.from("maps").select("id, name").order("name"),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <div className="card">
        <h1 className="text-3xl font-bold">{tournament.name}</h1>
        <p className="mt-1 text-sm text-slate-400">Управление турниром</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold text-orange-400">
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
                  <button className="text-xs text-red-400 hover:text-red-300" title="Убрать из турнира">
                    ✕
                  </button>
                </form>
              </li>
            );
          })}
          {!participants?.length && (
            <li className="text-sm text-slate-500">Участники ещё не добавлены</li>
          )}
        </ul>
        <AddPlayerForm action={addPlayerAction} tournamentId={tournamentId} />
      </div>

      <div className="card">
        <h2 className="mb-3 text-lg font-bold text-orange-400">Загрузка демки Fastcup</h2>
        <DemoUploadForm
          action={uploadDemoAction}
          tournamentId={tournamentId}
          mapOptions={maps ?? []}
        />
      </div>

      <div className="card">
        <h2 className="mb-3 text-lg font-bold text-orange-400">Матчи ({matches?.length ?? 0})</h2>
        {matches?.length ? (
          <ul className="divide-y divide-slate-800">
            {matches.map((m) => {
              const map = (m as { maps?: { name: string } | null }).maps;
              return (
                <li key={m.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="text-slate-300">
                    {m.team1_name} <b className="text-white">{m.team1_score}</b>:
                    <b className="text-white">{m.team2_score}</b> {m.team2_name}
                    {" · "}
                    {map?.name ?? "—"}
                  </span>
                  <span>
                    {m.parsed ? (
                      <span className="badge bg-green-500/15 text-green-400">обработана</span>
                    ) : (
                      <span className="badge bg-red-500/15 text-red-400">
                        ошибка: {m.parse_error ?? "не разобрана"}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            Матчей пока нет — загрузите первую демку выше
          </p>
        )}
      </div>

      <div>
        <Link href={`/tournaments/${tournamentId}`} className="btn-secondary">
          Публичная страница турнира
        </Link>
      </div>
    </section>
  );
}
