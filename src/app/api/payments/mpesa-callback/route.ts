import { NextResponse } from "next/server";

/**
 * Daraja STK callback sink. We record checkouts independently; this route
 * acknowledges Safaricom so retries stop. Ops still marks paid.
 */
export async function POST() {
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
