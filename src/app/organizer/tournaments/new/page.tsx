import { createTournamentAction } from "@/app/actions/organizer";
import { TournamentForm } from "@/components/OrganizerForms";
import { requireOrganizer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewTournamentPage() {
  await requireOrganizer();
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-3xl font-bold">Новый турнир</h1>
      <TournamentForm action={createTournamentAction} />
    </div>
  );
}
