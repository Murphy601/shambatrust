import { NextResponse } from "next/server";
import { z } from "zod";
import { issueOtp, isDevAuthMode, verifyOtp } from "@/lib/auth/otp";
import { normalizeKenyanPhone } from "@/lib/auth/phone";
import { readSession } from "@/lib/auth/session";
import {
  addAudit,
  approveSuccessionApproval,
  getSuccessionCase,
  listApprovalsForCase,
  pendingApprovalRoleFor,
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
    const role = pendingApprovalRoleFor(
      approvals,
      successionCase.status,
      phone,
    );
    if (!role) {
      return NextResponse.json(
        {
          error:
            successionCase.status === "awaiting_guardian_confirmations"
              ? "This claim is waiting on guardian confirmations, and this phone is not a pending guardian."
              : "This phone is not a pending trustee on this claim.",
        },
        { status: 403 },
      );
    }

    const { code, expiresAt } = await issueOtp(phone, "succession_confirm", {
      caseId: successionCase.id,
      role,
    });

    return NextResponse.json({
      ok: true,
      role,
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

  // The confirmation must come from the account that owns the phone, not just
  // from someone who can read the code over that person's shoulder.
  if (session.phone !== phone) {
    return NextResponse.json(
      { error: "Sign in with the trustee or guardian phone number to confirm." },
      { status: 403 },
    );
  }

  const otp = await verifyOtp(phone, parsed.data.code, "succession_confirm");
  if (!otp.ok) {
    return NextResponse.json({ error: otp.error }, { status: 400 });
  }

  try {
    const result = await approveSuccessionApproval({
      caseId: parsed.data.caseId,
      phone,
      userId: session.userId,
    });

    const approvedCount =
      result.role === "guardian" ? result.guardianApproved : result.trusteeApproved;
    const required =
      result.role === "guardian" ? result.guardianRequired : result.trusteeRequired;

    await addAudit({
      vaultId: result.successionCase.vaultId,
      actorUserId: session.userId,
      action:
        result.role === "guardian" ? "guardian_confirmed" : "trustee_approved",
      detail: `${approvedCount}/${required} · case ${result.successionCase.id} · now ${result.successionCase.status}`,
    });

    return NextResponse.json({
      ...result,
      // Kept for existing clients that read a single pair of counters.
      approvedCount,
      required,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Approval failed." },
      { status: 400 },
    );
  }
}
