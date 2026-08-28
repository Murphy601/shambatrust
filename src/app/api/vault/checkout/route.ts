import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVaultAccess } from "@/lib/vault-access";
import { addAudit, createPaymentCheckout, listPaymentCheckouts } from "@/lib/db/store";
import { CHECKOUT_DEFAULTS_KES, fromKes } from "@/lib/payments/fx";

const schema = z.object({
  kind: z.enum([
    "advocate_fee",
    "estate_maintenance",
    "title_lookup",
    "review",
    "amendment",
  ]),
  currency: z.enum(["KES", "USD", "GBP", "EUR"]),
  amount: z.number().positive().optional(),
  mpesaPhone: z.string().max(40).optional().default(""),
  detail: z.string().max(500).optional().default(""),
});

export async function GET() {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const checkouts = await listPaymentCheckouts(access.vault.id);
  return NextResponse.json({ checkouts });
}

export async function POST(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check checkout details." }, { status: 400 });
  }
  const kesDefault =
    CHECKOUT_DEFAULTS_KES[parsed.data.kind] ?? CHECKOUT_DEFAULTS_KES.advocate_fee;
  const amount =
    parsed.data.amount ?? fromKes(kesDefault, parsed.data.currency);
  const checkout = await createPaymentCheckout({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    kind: parsed.data.kind,
    currency: parsed.data.currency,
    amount,
    mpesaPhone: parsed.data.mpesaPhone,
    detail: parsed.data.detail,
  });
  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: "checkout_created",
    detail: `${checkout.currency} ${checkout.amount} · ${checkout.provider} · ${checkout.status}`,
  });
  return NextResponse.json({ checkout }, { status: 201 });
}
