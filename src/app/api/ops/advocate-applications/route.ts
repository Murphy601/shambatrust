import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAccess } from "@/lib/secure-docs/access";
import {
  listAdvocateApplications,
  reviewAdvocateApplication,
} from "@/lib/db/store";
import {
  advocatePortalLoginUrl,
  buildAdvocateDecisionMessage,
  buildAdvocateDecisionWhatsAppUrl,
} from "@/lib/advocate/outreach";

export async function GET() {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const applications = await listAdvocateApplications();
  return NextResponse.json({ applications });
}

const reviewSchema = z.object({
  applicationId: z.string(),
  decision: z.enum(["approved", "rejected", "needs_info"]),
  adminNotes: z.string().optional().default(""),
});

export async function POST(request: Request) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const parsed = reviewSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review payload." }, { status: 400 });
  }

  try {
    const { application, user } = await reviewAdvocateApplication({
      applicationId: parsed.data.applicationId,
      decision: parsed.data.decision,
      adminNotes: parsed.data.adminNotes,
      reviewedByUserId: access.session.userId,
    });

    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3001";
    const portalUrl = advocatePortalLoginUrl(origin);
    const message = buildAdvocateDecisionMessage({
      fullName: application.fullName,
      status: application.status,
      adminNotes: application.adminNotes,
      portalUrl,
    });
    const whatsappUrl = buildAdvocateDecisionWhatsAppUrl({
      phone: application.phone,
      fullName: application.fullName,
      status: application.status,
      adminNotes: application.adminNotes,
      portalUrl,
    });

    return NextResponse.json({
      application,
      user,
      portalUrl,
      message,
      whatsappUrl,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Review failed." },
      { status: 400 },
    );
  }
}
