import { readSession, type SessionPayload } from "@/lib/auth/session";
import {
  getAsset,
  getLegalDocument,
  getReviewRequest,
  getSuccessionCase,
  getVaultById,
} from "@/lib/db/store";
import type { ReviewRequest } from "@/lib/db/types";

export async function requireAdminAccess(): Promise<
  | { ok: true; session: SessionPayload }
  | { ok: false; status: number; error: string }
> {
  const session = await readSession();
  if (!session) {
    return { ok: false, status: 401, error: "Sign in required." };
  }
  if (session.role !== "admin") {
    return {
      ok: false,
      status: 403,
      error: "Operations desk access only.",
    };
  }
  return { ok: true, session };
}

export function advocateHasDocAccess(
  review: ReviewRequest,
  advocateUserId: string,
): boolean {
  if (review.docAccessRevokedAt) return false;
  if (review.status === "completed") return false;
  if (review.advocateId !== advocateUserId) return false;
  if (review.status !== "assigned") return false;
  return true;
}

export function canAdvocateSeeSensitiveBrief(
  review: ReviewRequest,
  advocateUserId: string,
): boolean {
  // Assigned advocate may see brief while active; after seal, metadata only
  if (review.advocateId === advocateUserId) return true;
  return false;
}

export type SecureDocTarget =
  | { kind: "asset"; assetId: string; reviewId: string }
  | { kind: "legal"; documentId: string; reviewId: string }
  | { kind: "asset_admin"; assetId: string; vaultId: string }
  | { kind: "death_cert"; caseId: string };

export async function resolveSecureDocAccess(
  session: SessionPayload,
  target: SecureDocTarget,
): Promise<
  | {
      ok: true;
      vaultId: string;
      filename: string;
      displayName: string;
      watermarkLabel: string;
    }
  | { ok: false; status: number; error: string }
> {
  if (target.kind === "death_cert") {
    const successionCase = await getSuccessionCase(target.caseId);
    if (!successionCase?.deathCertificatePath) {
      return { ok: false, status: 404, error: "Death certificate not found." };
    }
    const allowed =
      session.role === "admin" ||
      successionCase.filedByUserId === session.userId ||
      (session.role === "advocate" &&
        (successionCase.advocateId === session.userId ||
          successionCase.status === "succession_verified" ||
          successionCase.status === "with_advocate" ||
          successionCase.status === "succession_completed"));
    if (!allowed) {
      return {
        ok: false,
        status: 403,
        error: "Not authorised to view this death certificate.",
      };
    }
    return {
      ok: true,
      vaultId: successionCase.vaultId,
      filename: successionCase.deathCertificatePath,
      displayName: successionCase.deathCertificateName || "Death certificate",
      watermarkLabel: `${session.fullName || session.role} · view-only`,
    };
  }

  if (target.kind === "asset_admin") {
    if (session.role !== "admin") {
      return { ok: false, status: 403, error: "Ops access only." };
    }
    const vault = await getVaultById(target.vaultId);
    if (!vault) {
      return { ok: false, status: 404, error: "Vault not found." };
    }
    const asset = await getAsset(target.vaultId, target.assetId);
    if (!asset?.documentPath) {
      return { ok: false, status: 404, error: "No uploaded document on this asset." };
    }
    return {
      ok: true,
      vaultId: target.vaultId,
      filename: asset.documentPath,
      displayName: asset.documentName || asset.title,
      watermarkLabel: `OPS · ${session.fullName || "admin"} · ${session.phone} · view-only`,
    };
  }

  const review = await getReviewRequest(target.reviewId);
  if (!review) {
    return { ok: false, status: 404, error: "Case not found." };
  }

  const vault = await getVaultById(review.vaultId);
  if (!vault) {
    return { ok: false, status: 404, error: "Vault not found." };
  }

  if (session.role === "admin") {
    // admins always allowed (view-only stream still audited)
  } else if (session.role === "advocate") {
    if (!advocateHasDocAccess(review, session.userId)) {
      return {
        ok: false,
        status: 403,
        error:
          review.docAccessRevokedAt || review.status === "completed"
            ? "Document access ended when this vault was sealed."
            : "Claim this case first. Only the assigned advocate may view documents.",
      };
    }
  } else {
    return { ok: false, status: 403, error: "Not authorised to view documents." };
  }

  if (target.kind === "asset") {
    const asset = await getAsset(review.vaultId, target.assetId);
    if (!asset?.documentPath) {
      return { ok: false, status: 404, error: "No uploaded document on this asset." };
    }
    return {
      ok: true,
      vaultId: review.vaultId,
      filename: asset.documentPath,
      displayName: asset.documentName || asset.title,
      watermarkLabel: `${session.fullName || session.role} · ${session.phone} · view-only`,
    };
  }

  const doc = await getLegalDocument(target.documentId);
  if (!doc || doc.reviewRequestId !== review.id || !doc.documentPath) {
    return {
      ok: false,
      status: 404,
      error: "Certified file not found on this case.",
    };
  }
  return {
    ok: true,
    vaultId: review.vaultId,
    filename: doc.documentPath,
    displayName: doc.documentName || doc.title,
    watermarkLabel: `${session.fullName || session.role} · ${session.phone} · view-only`,
  };
}

export function isOpsAdminPhone(phone: string): boolean {
  const raw = process.env.OPS_ADMIN_PHONES || "";
  const allowed = raw
    .split(",")
    .map((p) => p.replace(/\D/g, ""))
    .filter(Boolean);
  if (allowed.length === 0) {
    // Dev default: empty list means no public self-serve admin; require env
    return false;
  }
  return allowed.includes(phone.replace(/\D/g, ""));
}
