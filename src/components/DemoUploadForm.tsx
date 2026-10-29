"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/app/actions/organizer";

type OrgAction = (
  prevState: ActionState,
  formData: FormData,
) => Promise<ActionState>;

export interface SeriesOption {
  id: number;
  label: string;
  team1Id: number;
  team2Id: number;
}

export default function DemoUploadForm({
  action,
  tournamentId,
  mapOptions,
  seriesOptions,
  teamOptions,
}: {
  action: OrgAction;
  tournamentId: number;
  mapOptions: { id: number; name: string }[];
  seriesOptions?: SeriesOption[];       // для формата «6 команд»
  teamOptions?: { id: number; name: string; group: string }[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.message) formRef.current?.reset();
  }, [state]);

  const teamMode = seriesOptions && seriesOptions.length > 0;

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

      {teamMode && (
        <>
          <div>
            <label className="label">Серия (куда записать карту)</label>
            <select name="series_id" className="input" required defaultValue="">
              <option value="" disabled>— выберите серию —</option>
              {seriesOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">
              Какая команда в демке стартовала за сторону T (это «команда 1» демки)?
            </label>
            <select name="parsed_team1_id" className="input" required defaultValue="">
              <option value="" disabled>— выберите команду —</option>
              {["A", "B"].map((letter) => (
                <optgroup key={letter} label={`Группа ${letter}`}>
                  {(teamOptions ?? [])
                    .filter((t) => t.group === letter)
                    .map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Если счёт в серии оказался «наоборот» — значит была выбрана не та команда слота T. Проверьте по первой карте: победитель карты должен совпасть.
            </p>
          </div>
        </>
      )}

      {!teamMode && (
        <>
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
        </>
      )}

      {state?.error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{state.error}</p>}
      {state?.message && <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">{state.message}</p>}
      <button className="btn self-start disabled:opacity-50" disabled={pending}>
        {pending ? "Разбираем демку (может занять до минуты)..." : "Загрузить и разобрать демку"}
      </button>
    </form>
  );
}
