import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVaultAccess } from "@/lib/vault-access";
import { addAudit, saveBurialWishes } from "@/lib/db/store";

const schema = z.object({
  burialLocation: z.enum(["ancestral", "cemetery", "undecided"]),
  burialDetails: z.string().default(""),
  committeeLead1: z.string().default(""),
  committeeLead2: z.string().default(""),
  specialMessage: z.string().default(""),
  burialPlotTitle: z.string().default(""),
  burialGpsLat: z.number().nullable().optional().default(null),
  burialGpsLng: z.number().nullable().optional().default(null),
  clanEldersToInvolve: z.string().default(""),
  culturalTraditions: z.string().default(""),
  saccoNomineeName: z.string().default(""),
  saccoNomineePhone: z.string().default(""),
  saccoAccount: z.string().default(""),
  mpesaNomineePhone: z.string().default(""),
  insurancePolicyRef: z.string().default(""),
  liquidityNotes: z.string().default(""),
});

export async function GET() {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  return NextResponse.json({ wishes: access.vault.burialWishes });
}

export async function POST(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Check burial wishes." }, { status: 400 });
  }
  const wishes = await saveBurialWishes(access.vault.id, parsed.data);
  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: "burial_wishes_saved",
    detail: wishes.burialLocation,
  });
  return NextResponse.json({ wishes });
}
