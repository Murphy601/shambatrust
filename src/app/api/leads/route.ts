import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeKenyanPhone } from "@/lib/auth/phone";
import { createMarketingLead } from "@/lib/db/store";

const schema = z.object({
  fullName: z.string().min(1).optional().default(""),
  phone: z.string().min(9),
  locale: z.enum(["en", "sw"]).optional().default("en"),
  source: z.enum(["audit", "referral", "whatsapp_bot", "status_tracker", "other"]),
  auditScore: z.number().nullable().optional(),
  auditAnswers: z.record(z.string(), z.string()).nullable().optional(),
  referralCode: z.string().nullable().optional(),
  notes: z.string().optional().default(""),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid lead payload." }, { status: 400 });
    }
    const phone = normalizeKenyanPhone(parsed.data.phone);
    if (!phone) {
      return NextResponse.json({ error: "Valid Kenyan phone required." }, { status: 400 });
    }
    const lead = await createMarketingLead({
      fullName: parsed.data.fullName || "Lead",
      phone,
      locale: parsed.data.locale,
      source: parsed.data.source,
      auditScore: parsed.data.auditScore ?? null,
      auditAnswers: parsed.data.auditAnswers ?? null,
      referralCode: parsed.data.referralCode ?? null,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ lead: { id: lead.id } });
  } catch {
    return NextResponse.json({ error: "Could not save lead." }, { status: 500 });
  }
}
