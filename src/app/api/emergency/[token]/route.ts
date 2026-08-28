import { NextResponse } from "next/server";
import {
  findUserById,
  findVaultByEmergencyToken,
  getExecutionPlan,
  listReviewRequests,
} from "@/lib/db/store";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  const vault = await findVaultByEmergencyToken(token);
  if (!vault) {
    return NextResponse.json({ error: "This emergency card is not valid." }, { status: 404 });
  }

  const [owner, reviews, plan] = await Promise.all([
    findUserById(vault.ownerId),
    listReviewRequests(vault.id),
    getExecutionPlan(vault.id),
  ]);

  const assigned = [...reviews]
    .filter((r) => r.advocateId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const advocate = assigned?.advocateId
    ? await findUserById(assigned.advocateId)
    : null;
  const trustee = plan?.trustees[0];
  const contactName =
    vault.emergencyPrimaryContactName ||
    trustee?.fullName ||
    vault.burialWishes?.committeeLead1 ||
    "";
  const contactPhone =
    vault.emergencyPrimaryContactPhone || trustee?.phone || "";

  return NextResponse.json({
    elderName: owner?.fullName || "ShambaTrust elder",
    county: owner?.county || "",
    primaryContactName: contactName,
    primaryContactPhone: contactPhone,
    medicalNotes: vault.emergencyMedicalNotes,
    physicalDocumentLocation: vault.physicalDocumentLocation,
    lawyerName: advocate?.fullName || "",
    lawyerLsk: advocate?.advocateLicense || "",
    lawyerPhone: advocate?.phone || "",
  });
}
