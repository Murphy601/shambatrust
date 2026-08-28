import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAccess } from "@/lib/secure-docs/access";
import { listBillingRecords, listAllPaymentCheckouts, setBillingPaid } from "@/lib/db/store";
import { seatCan, getOpsSeatRole } from "@/lib/ops/seats";

export async function GET() {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const records = await listBillingRecords();
  const checkouts = await listAllPaymentCheckouts();
  return NextResponse.json({
    records,
    checkouts,
    seat: getOpsSeatRole(access.session.phone),
  });
}

const patchSchema = z.object({
  id: z.string(),
  paid: z.boolean(),
});

export async function PATCH(request: Request) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const seat = getOpsSeatRole(access.session.phone);
  if (!seatCan(seat, "manage_billing")) {
    return NextResponse.json(
      { error: "Finance seat (or super) required to mark billing paid." },
      { status: 403 },
    );
  }
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  const row = await setBillingPaid(
    parsed.data.id,
    parsed.data.paid,
    access.session.userId,
  );
  if (!row) {
    return NextResponse.json({ error: "Billing record not found." }, { status: 404 });
  }
  return NextResponse.json({ record: row });
}
