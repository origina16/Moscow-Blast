"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/actions/organizer";

type OrgAction = (
  prevState: ActionState,
  formData: FormData,
) => Promise<ActionState>;

export function TournamentForm({ action }: { action: OrgAction }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);

  return (
    <form action={formAction} className="card flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="name">Название турнира</label>
        <input id="name" name="name" className="input" required minLength={3}
               placeholder="Moscow Blast Winter Cup #1" />
      </div>
      <div>
        <label className="label" htmlFor="description">Описание</label>
        <textarea id="description" name="description" className="input" rows={3}
                  placeholder="Формат, правила, призовой фонд..." />
      </div>
      <div>
        <label className="label" htmlFor="starts_at">Дата и время начала</label>
        <input id="starts_at" name="starts_at" type="datetime-local" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="format">Формат турнира</label>
        <select id="format" name="format" className="input" defaultValue="teams_6x5">
          <option value="teams_6x5">6 команд × 5 игроков (группы A/B + сетка, всё Bo3)</option>
          <option value="">Классический (просто список матчей)</option>
        </select>
      </div>
      {state?.error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{state.error}</p>}
      <button className="btn disabled:opacity-50" disabled={pending}>
        {pending ? "Создаём..." : "Создать турнир"}
      </button>
    </form>
  );
}

export function AddPlayerForm({
  action,
  tournamentId,
}: {
  action: OrgAction;
  tournamentId: number;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-start gap-3">
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <input name="nickname" className="input max-w-xs" placeholder="Никнейм игрока (как в Fastcup)" required />
      <button className="btn" disabled={pending}>{pending ? "..." : "Добавить игрока"}</button>
      {state?.error && <p className="w-full text-sm text-red-400">{state.error}</p>}
      {state?.message && <p className="w-full text-sm text-green-400">{state.message}</p>}
    </form>
  );
}
