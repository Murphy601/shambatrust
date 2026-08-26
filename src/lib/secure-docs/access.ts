import { readSession, type SessionPayload } from "@/lib/auth/session";
import {
  getAsset,
  getAudioTestament,
  getLegalDocument,
  getReviewRequest,
  getSuccessionCase,
  getVaultById,
  listAgentLinks,
  listReleasedCasesForUser,
  listReviewRequests,
  listSuccessionCasesForVault,
} from "@/lib/db/store";
import type { AudioTestament, ReviewRequest } from "@/lib/db/types";

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
  | { kind: "death_cert"; caseId: string }
  | { kind: "death_notification"; caseId: string };

/**
 * Who may play back a voice testament: the vault owner, their active family
 * agent, ops, and any advocate currently working the vault — either on an open
 * review or on the succession case that followed it.
 */
export async function resolveAudioTestamentAccess(
  session: SessionPayload,
  testamentId: string,
): Promise<
  | { ok: true; testament: AudioTestament }
  | { ok: false; status: number; error: string }
> {
  const testament = await getAudioTestament(testamentId);
  if (!testament) {
    return { ok: false, status: 404, error: "Recording not found." };
  }

  const vault = await getVaultById(testament.vaultId);
  if (!vault) {
    return { ok: false, status: 404, error: "Vault not found." };
  }

  if (session.role === "admin") return { ok: true, testament };
  if (vault.ownerId === session.userId) return { ok: true, testament };

  const agentLinks = await listAgentLinks(vault.id);
  if (
    agentLinks.some(
      (link) => link.status === "active" && link.agentUserId === session.userId,
    )
  ) {
    return { ok: true, testament };
  }

  if (session.role === "advocate") {
    const reviews = await listReviewRequests(vault.id);
    if (reviews.some((review) => advocateHasDocAccess(review, session.userId))) {
      return { ok: true, testament };
    }
    const cases = await listSuccessionCasesForVault(vault.id);
    if (
      cases.some(
        (successionCase) =>
          successionCase.advocateId === session.userId &&
          (successionCase.status === "with_advocate" ||
            successionCase.status === "succession_completed"),
      )
    ) {
      return { ok: true, testament };
    }
  }

  // Executors of a released vault — the whole point of the recording is that
  // the family eventually hears it in the elder's own voice.
  const releases = await listReleasedCasesForUser({
    userId: session.userId,
    phone: session.phone,
  });
  if (releases.some((release) => release.vaultId === vault.id)) {
    return { ok: true, testament };
  }

  return {
    ok: false,
    status: 403,
    error: "Not authorised to play this recording.",
  };
}

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
  if (target.kind === "death_cert" || target.kind === "death_notification") {
    const isNotification = target.kind === "death_notification";
    const successionCase = await getSuccessionCase(target.caseId);
    const filename = isNotification
      ? successionCase?.deathNotificationPath
      : successionCase?.deathCertificatePath;
    if (!successionCase || !filename) {
      return {
        ok: false,
        status: 404,
        error: isNotification
          ? "Death notification not found."
          : "Death certificate not found.",
      };
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
        error: isNotification
          ? "Not authorised to view this death notification."
          : "Not authorised to view this death certificate.",
      };
    }
    const displayName = isNotification
      ? successionCase.deathNotificationName || "Death notification"
      : successionCase.deathCertificateName || "Death certificate";
    return {
      ok: true,
      vaultId: successionCase.vaultId,
      filename,
      displayName,
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
