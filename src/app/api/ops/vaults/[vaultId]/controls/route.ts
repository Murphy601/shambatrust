import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAccess } from "@/lib/secure-docs/access";
import {
  addAudit,
  createSupportSession,
  getVaultById,
  listAudit,
  updateVaultOpsControls,
} from "@/lib/db/store";
import { getOpsSeatRole, seatCan } from "@/lib/ops/seats";

type Params = { params: Promise<{ vaultId: string }> };

const patchSchema = z.object({
  forceLocked: z.boolean().optional(),
  opsNotes: z.string().optional(),
  startSupport: z.boolean().optional(),
  supportNote: z.string().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const { vaultId } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const seat = getOpsSeatRole(access.session.phone);

  if (parsed.data.startSupport) {
    if (!seatCan(seat, "impersonate")) {
      return NextResponse.json(
        { error: "Compliance/super seat required for support mode." },
        { status: 403 },
      );
    }
    const session = await createSupportSession({
      adminUserId: access.session.userId,
      vaultId,
      note: parsed.data.supportNote || "Support view-as-elder",
    });
    await addAudit({
      vaultId,
      actorUserId: access.session.userId,
      action: "support_session_started",
      detail: session.id,
    });
    return NextResponse.json({
      supportSession: session,
      supportUrl: `/ops/support/${session.id}`,
    });
  }

  if (
    typeof parsed.data.forceLocked === "boolean" &&
    !seatCan(seat, "force_lock")
  ) {
    return NextResponse.json(
      { error: "Compliance/reviewer/super required to force-lock." },
      { status: 403 },
    );
  }

  const vault = await updateVaultOpsControls({
    vaultId,
    forceLocked: parsed.data.forceLocked,
    opsNotes: parsed.data.opsNotes,
  });
  if (!vault) {
    return NextResponse.json({ error: "Vault not found." }, { status: 404 });
  }

  if (typeof parsed.data.forceLocked === "boolean") {
    await addAudit({
      vaultId,
      actorUserId: access.session.userId,
      action: parsed.data.forceLocked ? "vault_force_locked" : "vault_force_unlocked",
      detail: parsed.data.opsNotes || "",
    });
  }

  const audit = await listAudit(vaultId);
  return NextResponse.json({ vault, audit: audit.slice(0, 20) });
}

export async function GET(_request: Request, { params }: Params) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const { vaultId } = await params;
  const vault = await getVaultById(vaultId);
  if (!vault) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ vault });
}
