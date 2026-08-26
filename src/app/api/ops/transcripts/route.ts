import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAccess } from "@/lib/secure-docs/access";
import {
  addAudit,
  findUserById,
  getAudioTestament,
  getVaultById,
  listAllPendingTranscripts,
  saveAudioTranscript,
} from "@/lib/db/store";
import { spokenLanguageLabel } from "@/lib/languages";

const schema = z.object({
  testamentId: z.string().min(1),
  transcript: z.string().max(20_000).optional().default(""),
  transcriptStatus: z.enum(["pending", "in_progress", "transcribed", "rejected"]),
  transcriptNotes: z.string().max(2000).optional().default(""),
});

export async function GET() {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const pending = await listAllPendingTranscripts();
  const rows = await Promise.all(
    pending.map(async (testament) => {
      const vault = await getVaultById(testament.vaultId);
      const owner = vault ? await findUserById(vault.ownerId) : null;
      return {
        ...testament,
        // The relative filename is a server detail; playback goes through the
        // audited stream endpoint instead.
        documentPath: null,
        languageLabel: spokenLanguageLabel(testament.language),
        ownerName: owner?.fullName || "Unknown elder",
        ownerPhone: owner?.phone || null,
        vaultStatus: vault?.status || null,
      };
    }),
  );

  return NextResponse.json({ testaments: rows });
}

export async function PATCH(request: Request) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transcript update." }, { status: 400 });
  }

  if (
    parsed.data.transcriptStatus === "transcribed" &&
    parsed.data.transcript.trim().length < 10
  ) {
    return NextResponse.json(
      { error: "Add the transcribed text before marking it complete." },
      { status: 400 },
    );
  }

  const existing = await getAudioTestament(parsed.data.testamentId);
  if (!existing) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }

  const testament = await saveAudioTranscript({
    testamentId: parsed.data.testamentId,
    transcript: parsed.data.transcript,
    transcriptStatus: parsed.data.transcriptStatus,
    transcriptNotes: parsed.data.transcriptNotes,
    transcribedByUserId: access.session.userId,
  });
  if (!testament) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }

  await addAudit({
    vaultId: testament.vaultId,
    actorUserId: access.session.userId,
    action: "testament_transcribed",
    detail: `${testament.title} · ${testament.transcriptStatus}`,
  });

  return NextResponse.json({ testament: { ...testament, documentPath: null } });
}
