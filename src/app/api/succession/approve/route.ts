import { NextResponse } from "next/server";
import { z } from "zod";
import { issueOtp, isDevAuthMode, verifyOtp } from "@/lib/auth/otp";
import { normalizeKenyanPhone } from "@/lib/auth/phone";
import { readSession } from "@/lib/auth/session";
import {
  addAudit,
  approveSuccessionTrustee,
  getSuccessionCase,
  listApprovalsForCase,
} from "@/lib/db/store";

const requestSchema = z.object({
  caseId: z.string(),
  phone: z.string().min(9),
});

const confirmSchema = z.object({
  caseId: z.string(),
  phone: z.string().min(9),
  code: z.string().min(4).max(8),
});

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "confirm";
  const body = await request.json();

  if (action === "request") {
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const phone = normalizeKenyanPhone(parsed.data.phone);
    if (!phone) {
      return NextResponse.json({ error: "Invalid phone." }, { status: 400 });
    }

    const successionCase = await getSuccessionCase(parsed.data.caseId);
    if (!successionCase) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }

    const approvals = await listApprovalsForCase(successionCase.id);
    const mine = approvals.find(
      (a) => a.trusteePhone === phone && a.status === "pending",
    );
    if (!mine) {
      return NextResponse.json(
        { error: "This phone is not a pending trustee on this claim." },
        { status: 403 },
      );
    }

    const { code, expiresAt } = await issueOtp(phone, "succession_confirm", {
      caseId: successionCase.id,
    });

    return NextResponse.json({
      ok: true,
      expiresAt,
      ...(isDevAuthMode() ? { devCode: code } : {}),
    });
  }

  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid confirmation." }, { status: 400 });
  }

  const phone = normalizeKenyanPhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "Invalid phone." }, { status: 400 });
  }

  // Prefer signed-in phone matching trustee
  if (session.phone !== phone) {
    return NextResponse.json(
      { error: "Sign in with the trustee phone number to approve." },
      { status: 403 },
    );
  }

  const otp = await verifyOtp(phone, parsed.data.code, "succession_confirm");
  if (!otp.ok) {
    return NextResponse.json({ error: otp.error }, { status: 400 });
  }

  try {
    const result = await approveSuccessionTrustee({
      caseId: parsed.data.caseId,
      trusteePhone: phone,
      userId: session.userId,
    });

    await addAudit({
      vaultId: result.successionCase.vaultId,
      actorUserId: session.userId,
      action: "trustee_approved",
      detail: `${result.approvedCount}/${result.required} · case ${result.successionCase.id}`,
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Approval failed." },
      { status: 400 },
    );
  }
}
