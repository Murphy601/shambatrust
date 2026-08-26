import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireVaultAccess } from "@/lib/vault-access";
import { vaultContentLocked } from "@/lib/vault-lock";
import {
  addAudit,
  createAudioTestament,
  getAsset,
  listAudioTestaments,
  writeStoredFile,
} from "@/lib/db/store";
import {
  MAX_TESTAMENT_BYTES,
  audioExtension,
  baseMimeType,
  isSupportedAudioType,
} from "@/lib/audio";
import { normalizeSpokenLanguage, spokenLanguageLabel } from "@/lib/languages";

export async function GET() {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const testaments = await listAudioTestaments(access.vault.id);
  return NextResponse.json({
    testaments,
    asAgent: access.asAgent,
    locked: vaultContentLocked(access.vault),
  });
}

export async function POST(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (vaultContentLocked(access.vault)) {
    return NextResponse.json(
      {
        error:
          "This vault is in legal review. Request an amendment before adding new recordings.",
      },
      { status: 403 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No recording uploaded." }, { status: 400 });
  }
  if (file.size > MAX_TESTAMENT_BYTES) {
    return NextResponse.json(
      { error: "Recording too large (max 20MB). Try a shorter message." },
      { status: 400 },
    );
  }

  const mimeType = baseMimeType(file.type || "audio/webm");
  if (!isSupportedAudioType(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported audio format (${file.type || "unknown"}).` },
      { status: 400 },
    );
  }

  const language = normalizeSpokenLanguage(form.get("language"));
  const title = String(form.get("title") || "").trim();
  const rawDuration = Number(form.get("durationSeconds"));
  const durationSeconds =
    Number.isFinite(rawDuration) && rawDuration > 0
      ? Math.round(rawDuration)
      : null;

  const requestedAssetId = String(form.get("assetId") || "").trim();
  let assetId: string | null = null;
  if (requestedAssetId) {
    const asset = await getAsset(access.vault.id, requestedAssetId);
    if (!asset) {
      return NextResponse.json(
        { error: "Linked asset is not in this vault." },
        { status: 400 },
      );
    }
    assetId = asset.id;
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `testaments/testament-${access.vault.id}-${randomUUID()}${audioExtension(mimeType)}`;
  const documentPath = await writeStoredFile(filename, bytes, mimeType);

  const testament = await createAudioTestament({
    vaultId: access.vault.id,
    assetId,
    recordedByUserId: access.session.userId,
    recordedByAgent: access.asAgent,
    title,
    language,
    documentName: file.name || `${title || "Voice testament"}${audioExtension(mimeType)}`,
    documentPath,
    mimeType,
    fileSize: bytes.byteLength,
    durationSeconds,
  });

  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: "testament_recorded",
    detail: `${testament.title} · ${spokenLanguageLabel(language)}${
      access.asAgent ? " · captured by family agent" : ""
    }`,
  });

  return NextResponse.json({ testament });
}
