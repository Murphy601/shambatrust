import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVaultAccess } from "@/lib/vault-access";
import {
  addAudit,
  findUserById,
  listActiveAdvocates,
  saveConsultBooking,
} from "@/lib/db/store";

const schema = z.object({
  advocateId: z.string().min(1),
  scheduledAt: z.string().datetime(),
  notes: z.string().max(2000).optional().default(""),
  diasporaSignerName: z.string().max(120).optional().default(""),
  diasporaSignerPhone: z.string().max(40).optional().default(""),
});

export async function POST(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Pick an LSK advocate and a video slot." },
      { status: 400 },
    );
  }
  const advocates = await listActiveAdvocates();
  const advocate = advocates.find((a) => a.id === parsed.data.advocateId);
  if (!advocate) {
    return NextResponse.json({ error: "That advocate is not available." }, { status: 404 });
  }
  const owner = await findUserById(access.vault.ownerId);
  const booking = await saveConsultBooking({
    reviewRequestId: null,
    vaultId: access.vault.id,
    advocateId: advocate.id,
    mode: "video",
    scheduledAt: parsed.data.scheduledAt,
    notes: parsed.data.notes,
    kind: "video_notarization",
    diasporaSignerName:
      parsed.data.diasporaSignerName || owner?.fullName || "",
    diasporaSignerPhone:
      parsed.data.diasporaSignerPhone || owner?.phone || "",
    meetingUrl: "",
  });
  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: "video_notarization_scheduled",
    detail: `${advocate.fullName} · ${booking.scheduledAt}`,
  });
  return NextResponse.json({ booking }, { status: 201 });
}
