import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/secure-docs/access";
import {
  listAdvocateApplications,
  listAllReviewRequests,
  listAllSuccessionCases,
  listAllVaults,
  listBillingRecords,
  listEldersNewestFirst,
} from "@/lib/db/store";
import { findSlaBreaches, buildSlaAlertMessage } from "@/lib/ops/sla";
import { getOpsSeatRole } from "@/lib/ops/seats";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export async function GET(request: Request) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const [elders, reviews, vaults, apps, succession, billing] = await Promise.all([
    listEldersNewestFirst(),
    listAllReviewRequests(),
    listAllVaults(),
    listAdvocateApplications(),
    listAllSuccessionCases(),
    listBillingRecords(),
  ]);

  const slaBreaches = findSlaBreaches(reviews);
  const origin =
    request.headers.get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3001";

  const slaAlerts = slaBreaches.map((b) => {
    const msg = buildSlaAlertMessage(b, origin);
    return {
      ...b,
      message: msg,
      whatsappUrl: buildWhatsAppUrl(msg),
    };
  });

  const amendmentVolume = billing.filter(
    (b) =>
      b.kind === "amendment_opened" || b.kind === "amendment_submitted",
  ).length;

  const openSuccession = succession.filter(
    (c) =>
      c.status !== "succession_completed" && c.status !== "succession_rejected",
  );

  return NextResponse.json({
    seat: access.session.phone
      ? getOpsSeatRole(access.session.phone)
      : "super",
    stats: {
      elders: elders.length,
      vaults: vaults.length,
      openReviews: reviews.filter((r) => r.status !== "completed").length,
      sealed: vaults.filter((v) => v.status === "sealed").length,
      slaBreaches: slaBreaches.length,
      pendingAdvocateApps: apps.filter((a) => a.status === "pending").length,
      successionOpen: openSuccession.length,
      amendmentVolume,
      billingUnpaid: billing.filter((b) => !b.paid).length,
      billingUnpaidKes: billing
        .filter((b) => !b.paid)
        .reduce((s, b) => s + b.amountKes, 0),
    },
    slaAlerts,
    successionPipeline: [
      "succession_filed",
      "awaiting_trustee_otps",
      "pending_ops_verification",
      "succession_verified",
      "with_advocate",
    ].map((status) => ({
      status,
      count: succession.filter((c) => c.status === status).length,
    })),
    elders: elders.slice(0, 8).map(({ user, vault }) => ({
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      createdAt: user.createdAt,
      vaultId: vault?.id || null,
      vaultStatus: vault?.status || null,
      packageTier: vault?.packageTier || null,
    })),
    submissions: reviews
      .map((r) => ({
        at: r.createdAt,
        reviewId: r.id,
        vaultId: r.vaultId,
        status: r.status,
        packageTier: r.packageTier,
      }))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 10),
  });
}
