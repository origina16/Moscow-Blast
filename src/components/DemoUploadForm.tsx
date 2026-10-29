"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/actions/organizer";
import { useEffect, useRef } from "react";

type OrgAction = (
  prevState: ActionState,
  formData: FormData,
) => Promise<ActionState>;

export default function DemoUploadForm({
  action,
  tournamentId,
  mapOptions,
}: {
  action: OrgAction;
  tournamentId: number;
  mapOptions: { id: number; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.message) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <div>
        <label className="label">Файл демки (.dem из Fastcup)</label>
        <input
          name="demo"
          type="file"
          accept=".dem"
          required
          className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-500 file:px-3 file:py-2 file:text-white"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Название команды 1</label>
          <input name="team1_name" className="input" placeholder="Team 1" />
        </div>
        <div>
          <label className="label">Название команды 2</label>
          <input name="team2_name" className="input" placeholder="Team 2" />
        </div>
      </div>
      <div>
        <label className="label">Карта (если не определится автоматически)</label>
        <select name="map_id" className="input" defaultValue="">
          <option value="">— авто —</option>
          {mapOptions.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
      {state?.error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{state.error}</p>}
      {state?.message && <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">{state.message}</p>}
      <button className="btn self-start disabled:opacity-50" disabled={pending}>
        {pending ? "Разбираем демку (может занять до минуты)..." : "Загрузить и разобрать демку"}
      </button>
    </form>
  );
}
