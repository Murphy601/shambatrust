import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import {
  addAudit,
  createSuccessionCase,
  getExecutionPlan,
  getVaultById,
  getVaultForUser,
  listSuccessionCasesForVault,
  uploadsDir,
  userCanFileSuccession,
} from "@/lib/db/store";

const jsonSchema = z.object({
  vaultId: z.string(),
  deathDate: z.string().min(4),
  filerNotes: z.string().optional().default(""),
  deathCertificateName: z.string().nullable().optional(),
  deathCertificatePath: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const vaultId = url.searchParams.get("vaultId");

  if (vaultId) {
    const cases = await listSuccessionCasesForVault(vaultId);
    return NextResponse.json({ cases });
  }

  // Default: cases for the caller's vault(s)
  const access = await getVaultForUser(session.userId);
  if (!access) {
    return NextResponse.json({ cases: [] });
  }
  const cases = await listSuccessionCasesForVault(access.vault.id);
  return NextResponse.json({ cases, vaultId: access.vault.id });
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";
  let vaultId: string;
  let deathDate: string;
  let filerNotes = "";
  let deathCertificateName: string | null = null;
  let deathCertificatePath: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    vaultId = String(form.get("vaultId") || "");
    deathDate = String(form.get("deathDate") || "");
    filerNotes = String(form.get("filerNotes") || "");
    const file = form.get("file");
    if (file instanceof File && file.size > 0) {
      if (file.size > 8 * 1024 * 1024) {
        return NextResponse.json(
          { error: "File too large (max 8MB)." },
          { status: 400 },
        );
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filename = `death-${vaultId}-${randomUUID()}-${safeName}`;
      const dir = uploadsDir();
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, filename), bytes);
      deathCertificateName = file.name;
      deathCertificatePath = filename;
    }
  } else {
    const parsed = jsonSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid claim." }, { status: 400 });
    }
    vaultId = parsed.data.vaultId;
    deathDate = parsed.data.deathDate;
    filerNotes = parsed.data.filerNotes;
    deathCertificateName = parsed.data.deathCertificateName ?? null;
    deathCertificatePath = parsed.data.deathCertificatePath ?? null;
  }

  if (!vaultId || !deathDate) {
    return NextResponse.json(
      { error: "Vault and death date are required." },
      { status: 400 },
    );
  }

  const vault = await getVaultById(vaultId);
  if (!vault) {
    return NextResponse.json({ error: "Vault not found." }, { status: 404 });
  }
  if (vault.status !== "sealed") {
    return NextResponse.json(
      { error: "Succession can only be filed on a sealed vault." },
      { status: 400 },
    );
  }

  const allowed = await userCanFileSuccession({
    userId: session.userId,
    phone: session.phone,
    vaultId,
  });
  if (!allowed) {
    return NextResponse.json(
      {
        error:
          "You are not authorised to file for this vault. You must be a named trustee, heir, or active family agent.",
      },
      { status: 403 },
    );
  }

  const plan = await getExecutionPlan(vaultId);
  const requireCert = plan?.requireDeathCertificate !== false;
  if (requireCert && !deathCertificatePath) {
    return NextResponse.json(
      { error: "A death certificate upload is required for this vault." },
      { status: 400 },
    );
  }

  try {
    const { case: successionCase, approvals } = await createSuccessionCase({
      vaultId,
      filedByUserId: session.userId,
      deathDate,
      deathCertificateName,
      deathCertificatePath,
      filerNotes,
      trustees: plan?.trustees || [],
      minTrusteeApprovals: plan?.minTrusteeApprovals || 1,
    });

    await addAudit({
      vaultId,
      actorUserId: session.userId,
      action: "succession_filed",
      detail: `Case ${successionCase.id} · death ${deathDate} · status ${successionCase.status}`,
    });

    return NextResponse.json({ case: successionCase, approvals });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not file claim." },
      { status: 400 },
    );
  }
}
