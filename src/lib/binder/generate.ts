import { createHash } from "crypto";
import path from "path";
import PDFDocument from "pdfkit";
import { PDFDocument as PdfLibDocument } from "pdf-lib";
import type {
  Allocation,
  Asset,
  AudioTestament,
  Beneficiary,
  ExecutionPlan,
  LegalDocument,
  ReviewRequest,
  TitleLookupRecord,
  User,
  Vault,
} from "@/lib/db/types";
import {
  addAudit,
  createVaultBinderGenerating,
  failVaultBinder,
  finalizeVaultBinder,
  findUserById,
  getExecutionPlan,
  getReviewRequest,
  listAllocations,
  listAssets,
  listAudioTestaments,
  listAudit,
  listBeneficiaries,
  listLegalDocumentsForReview,
  listTitleLookups,
  readStoredFile,
  resetVaultBinderGenerating,
  getVaultById,
  getVaultBinder,
  writeStoredFile,
} from "@/lib/db/store";
import { spokenLanguageLabel } from "@/lib/languages";
import { registerBinderFonts } from "@/lib/binder/fonts";

type Snapshot = {
  vault: Vault;
  owner: User;
  review: ReviewRequest;
  advocate: User | null;
  assets: Asset[];
  beneficiaries: Beneficiary[];
  allocations: Allocation[];
  documents: LegalDocument[];
  lookups: TitleLookupRecord[];
  plan: ExecutionPlan | null;
  testaments: AudioTestament[];
  auditLines: string[];
  sealedAt: string;
  version: number;
  advocateName: string;
};

type Attachment = {
  label: string;
  bytes: Buffer;
  filename: string;
  kind: "image" | "pdf" | "other";
};

function detectKind(filePath: string): Attachment["kind"] {
  const ext = path.extname(filePath).toLowerCase();
  if ([".jpg", ".jpeg", ".png"].includes(ext)) return "image";
  if (ext === ".pdf") return "pdf";
  return "other";
}

async function collectAttachments(snapshot: Snapshot): Promise<Attachment[]> {
  const out: Attachment[] = [];

  const push = async (label: string, stored: string | null | undefined) => {
    if (!stored) return;
    const bytes = await readStoredFile(stored);
    if (!bytes) return;
    out.push({
      label,
      bytes,
      filename: stored,
      kind: detectKind(stored),
    });
  };

  await push("National ID — front", snapshot.owner.idFrontPath);
  await push("National ID — back", snapshot.owner.idBackPath);

  for (const asset of snapshot.assets) {
    await push(`Asset deed — ${asset.title}`, asset.documentPath);
  }

  for (const doc of snapshot.documents) {
    if (doc.status === "signed" || doc.status === "certified") {
      await push(`Certified instrument — ${doc.title}`, doc.documentPath);
    }
  }

  return out;
}

function writeNarrativePdf(snapshot: Snapshot, imageAttachments: Attachment[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 56, bottom: 56, left: 56, right: 56 },
      info: {
        Title: `ShambaTrust Vault Binder v${snapshot.version}`,
        Author: "ShambaTrust",
        Subject: `Sealed vault ${snapshot.vault.id}`,
      },
    });

    const fonts = registerBinderFonts(doc);

    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("error", reject);
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    const h = (text: string) => {
      doc.moveDown(0.6);
      doc.font(fonts.bold).fontSize(14).fillColor("#1a3a28").text(text);
      doc.moveDown(0.3);
      doc.font(fonts.regular).fontSize(10).fillColor("#222222");
    };

    const line = (label: string, value: string) => {
      doc
        .font(fonts.bold)
        .text(`${label}: `, { continued: true })
        .font(fonts.regular)
        .text(value || "—");
    };

    // Cover
    doc.font(fonts.bold).fontSize(22).fillColor("#1a3a28").text("ShambaTrust");
    doc.moveDown(0.3);
    doc.fontSize(16).text("Sealed Vault Binder");
    doc.moveDown(0.8);
    doc.font(fonts.regular).fontSize(11).fillColor("#333333");
    line("Elder", snapshot.owner.fullName);
    line("Phone", snapshot.owner.phone);
    if (snapshot.owner.email) line("Email", snapshot.owner.email);
    line("Vault ID", snapshot.vault.id);
    line("Package", snapshot.review.packageTier);
    line("Binder version", `v${snapshot.version}`);
    line("Sealed at", new Date(snapshot.sealedAt).toLocaleString("en-KE"));
    line("Advocate", snapshot.advocateName);
    if (snapshot.advocate?.advocateLicense) {
      line("LSK", snapshot.advocate.advocateLicense);
    }
    doc.moveDown(1);
    doc
      .font(fonts.oblique)
      .fontSize(9)
      .fillColor("#555555")
      .text(
        "This binder is an immutable snapshot generated when the partner advocate sealed the vault. Later amendments produce a new version after re-seal.",
      );

    // Elder identity
    doc.addPage();
    h("1. Elder identity");
    line("Full name", snapshot.owner.fullName);
    line("Phone", snapshot.owner.phone);
    line("Email", snapshot.owner.email || "—");
    line("County", snapshot.owner.county || "—");
    line("Address", snapshot.owner.address || "—");
    line("Profile complete", snapshot.owner.profileComplete ? "Yes" : "No");

    // Assets
    doc.addPage();
    h("2. Assets register");
    if (snapshot.assets.length === 0) {
      doc.text("No assets recorded.");
    }
    for (const [i, asset] of snapshot.assets.entries()) {
      doc.moveDown(0.4);
      doc.font(fonts.bold).text(`${i + 1}. ${asset.title} (${asset.type})`);
      doc.font(fonts.regular);
      if (asset.titleNumber) line("Title number", asset.titleNumber);
      if (asset.parcelNumber) line("Parcel number", asset.parcelNumber);
      if (asset.blockNumber) line("Block number", asset.blockNumber);
      if (asset.registrationSection) {
        line("Registration section", asset.registrationSection);
      }
      if (asset.landRegistryOffice) {
        line("County land registry", asset.landRegistryOffice);
      }
      if (asset.county) line("County", asset.county);
      if (asset.subCounty) line("Sub-county", asset.subCounty);
      if (asset.landmark) line("Landmark", asset.landmark);
      if (asset.gpsLat != null && asset.gpsLng != null) {
        line("GPS pin", `${asset.gpsLat}, ${asset.gpsLng}`);
      }
      if (asset.registrationNumber) line("Registration", asset.registrationNumber);
      if (asset.makeModel) line("Make/model", asset.makeModel);
      if (asset.bankName) line("Bank", `${asset.bankName} ${asset.accountNumber}`.trim());
      if (asset.businessRegNumber) line("Business reg", asset.businessRegNumber);
      if (asset.saccoName) line("SACCO", asset.saccoName);
      if (asset.saccoMemberNumber) line("SACCO member", asset.saccoMemberNumber);
      if (asset.mpesaNumber) line("Linked M-Pesa", asset.mpesaNumber);
      if (asset.saccoNominees.length > 0) {
        doc.font(fonts.bold).text("SACCO nominees (paid outside the estate)");
        doc.font(fonts.regular);
        for (const nominee of asset.saccoNominees) {
          doc.text(
            `• ${nominee.fullName}${nominee.relationship ? ` (${nominee.relationship})` : ""} — ${nominee.percentage}%` +
              (nominee.idNumber ? ` · ID ${nominee.idNumber}` : ""),
          );
        }
      }
      if (asset.notes) line("Notes", asset.notes);
      if (asset.disputeFlag || asset.familyAlert) {
        line(
          "Protection flag",
          asset.disputeFlag ? "Active dispute / caveat" : "Family unauthorized-sale alert",
        );
        if (asset.disputeNotes) line("Alert notes", asset.disputeNotes);
      }
      if (asset.documentName) line("Attached deed", asset.documentName);
    }

    // Heirs
    doc.addPage();
    h("3. Heirs");
    if (snapshot.beneficiaries.length === 0) {
      doc.text("No heirs recorded.");
    }
    for (const [i, heir] of snapshot.beneficiaries.entries()) {
      doc.moveDown(0.3);
      doc
        .font(fonts.bold)
        .text(`${i + 1}. ${heir.fullName}`)
        .font(fonts.regular);
      line("Relationship", heir.relationship);
      line("ID number", heir.idNumber || "—");
      line("Phone", heir.phone || "—");
    }

    h("4. Allocations");
    if (snapshot.allocations.length === 0) {
      doc.text("No allocations recorded.");
    }
    for (const alloc of snapshot.allocations) {
      const heir =
        snapshot.beneficiaries.find((b) => b.id === alloc.beneficiaryId)?.fullName ||
        alloc.beneficiaryId;
      const asset =
        snapshot.assets.find((a) => a.id === alloc.assetId)?.title ||
        (alloc.assetId ? alloc.assetId : "General / specific gift");
      doc.moveDown(0.25);
      doc.text(
        `• ${heir} → ${asset}` +
          (alloc.percentage != null ? ` (${alloc.percentage}%)` : "") +
          (alloc.specificGift ? ` — ${alloc.specificGift}` : ""),
      );
    }

    h("4b. Will, trust & burial drafts");
    if (snapshot.vault.willDraft) {
      const will = snapshot.vault.willDraft;
      doc.font(fonts.bold).text("Will builder");
      doc.font(fonts.regular);
      line("Testator", will.testatorName);
      line("ID", will.testatorId);
      line("Residence", will.primaryResidence);
      line("Executor", `${will.executorName} ${will.executorPhone}`.trim());
      line("Alt executor", `${will.altExecutorName} ${will.altExecutorPhone}`.trim());
      line("Guardian", `${will.guardianName} ${will.guardianPhone}`.trim());
      line(
        "Section 11 witnesses",
        will.witnessAcknowledged ? "Acknowledged" : "Not yet acknowledged",
      );
      if (will.notes) line("Notes", will.notes);
      if (will.testamentaryTrustEnabled) {
        line("Testamentary trust", `Until age ${will.testamentaryTrustUntilAge || 18}`);
        if (will.testamentaryTrustTerms) line("Trust terms", will.testamentaryTrustTerms);
      }
    } else {
      doc.text("No will builder draft.");
    }
    doc.moveDown(0.4);
    if (snapshot.vault.trustDraft) {
      const trust = snapshot.vault.trustDraft;
      doc.font(fonts.bold).text("Family land trust");
      doc.font(fonts.regular);
      line("Trust name", trust.trustName);
      line("Primary trustee", trust.primaryTrustee);
      line("Co-trustee", trust.coTrustee);
      if (trust.enforcerName) line("Enforcer", trust.enforcerName);
      line("Title numbers", trust.titleNumbers);
      if (trust.conditions) line("Conditions", trust.conditions);
    } else {
      doc.text("No family trust draft.");
    }
    doc.moveDown(0.4);
    if (snapshot.vault.burialWishes) {
      const wishes = snapshot.vault.burialWishes;
      doc.font(fonts.bold).text("Burial wishes");
      doc.font(fonts.regular);
      line("Location", wishes.burialLocation);
      line("Details", wishes.burialDetails);
      line("Committee", `${wishes.committeeLead1} / ${wishes.committeeLead2}`.trim());
      if (wishes.burialPlotTitle) line("Burial plot", wishes.burialPlotTitle);
      if (wishes.clanEldersToInvolve) line("Clan elders", wishes.clanEldersToInvolve);
      if (wishes.mpesaNomineePhone) line("M-Pesa nominee", wishes.mpesaNomineePhone);
      if (wishes.saccoNomineeName) line("SACCO nominee", wishes.saccoNomineeName);
      if (wishes.specialMessage) line("Message", wishes.specialMessage);
    } else {
      doc.text("No burial wishes recorded.");
    }

    // Execution
    doc.addPage();
    h("5. Execution plan");
    if (!snapshot.plan) {
      doc.text("No execution plan on file.");
    } else {
      line("Trigger", snapshot.plan.triggerType);
      line(
        "Min trustee approvals",
        String(snapshot.plan.minTrusteeApprovals),
      );
      line(
        "Min guardian confirmations",
        String(snapshot.plan.minGuardianApprovals),
      );
      line(
        "Death certificate required",
        snapshot.plan.requireDeathCertificate ? "Yes" : "No",
      );
      line(
        "Death notification required",
        snapshot.plan.requireDeathNotification ? "Yes" : "No",
      );
      line("Cooling hours", String(snapshot.plan.coolingHours));
      doc.moveDown(0.3);
      doc.font(fonts.bold).text("Trustees");
      doc.font(fonts.regular);
      for (const t of snapshot.plan.trustees || []) {
        doc.text(
          `• ${t.fullName} · ${t.phone || "—"}${t.idNumber ? ` · ID ${t.idNumber}` : ""}`,
        );
      }
      if (snapshot.plan.enforcer) {
        doc.moveDown(0.3);
        doc.font(fonts.bold).text("Enforcer");
        doc.font(fonts.regular);
        doc.text(
          `• ${snapshot.plan.enforcer.fullName} · ${snapshot.plan.enforcer.phone || "—"}` +
            (snapshot.plan.enforcer.organization
              ? ` · ${snapshot.plan.enforcer.organization}`
              : ""),
        );
      }
      doc.moveDown(0.3);
      doc.font(fonts.bold).text("Guardians (dual verification)");
      doc.font(fonts.regular);
      if ((snapshot.plan.guardians || []).length === 0) {
        doc.text("None named.");
      }
      for (const g of snapshot.plan.guardians || []) {
        doc.text(
          `• ${g.fullName} · ${g.phone || "—"}${g.relationship ? ` · ${g.relationship}` : ""}${
            g.idNumber ? ` · ID ${g.idNumber}` : ""
          }`,
        );
      }
    }

    // Review & consent
    h("6. Review package & consent");
    line("Review ID", snapshot.review.id);
    line("Package", snapshot.review.packageTier);
    line("Consult mode", snapshot.review.consultMode);
    line("Status", snapshot.review.status);
    line(
      "Consent",
      snapshot.review.consentAcceptedAt
        ? `${snapshot.review.consentVersion || "?"} at ${new Date(snapshot.review.consentAcceptedAt).toLocaleString("en-KE")}`
        : "Not recorded",
    );
    if (snapshot.review.notes) line("Elder notes", snapshot.review.notes);
    doc.moveDown(0.3);
    doc.font(fonts.bold).text("Checklist");
    doc.font(fonts.regular);
    for (const item of snapshot.review.checklist || []) {
      doc.text(`${item.done ? "[x]" : "[ ]"} ${item.label}`);
    }

    // Legal instruments
    doc.addPage();
    h("7. Advocate instruments");
    if (snapshot.documents.length === 0) {
      doc.text("No legal documents on this review.");
    }
    for (const d of snapshot.documents) {
      doc.moveDown(0.5);
      doc
        .font(fonts.bold)
        .text(`${d.title} (${d.type}) — ${d.status}`)
        .font(fonts.regular);
      if (d.stampRef) {
        line(
          "Legal stamp",
          `${d.stampRef} · ${d.stampAdvocateName || "—"}` +
            (d.stampLskNumber ? ` · LSK ${d.stampLskNumber}` : "") +
            (d.stampCounty ? ` · ${d.stampCounty}` : "") +
            (d.stampedAt
              ? ` · ${new Date(d.stampedAt).toLocaleString("en-KE")}`
              : ""),
        );
        if (d.stampNotes) line("Stamp annotation", d.stampNotes);
      }
      if (d.signatureName) {
        line("Signed by", `${d.signatureName} at ${d.signedAt || "—"}`);
      }
      if (d.body?.trim()) {
        doc.moveDown(0.2);
        doc.fontSize(9).text(d.body.trim(), { align: "left" });
        doc.fontSize(10);
      }
      if (d.documentName) line("Certified upload", d.documentName);
    }

    // Title lookups
    h("8. Title lookups");
    if (snapshot.lookups.length === 0) {
      doc.text("No title lookups recorded.");
    }
    for (const lookup of snapshot.lookups) {
      doc.moveDown(0.3);
      line("Title", lookup.titleNumber);
      line(
        "Result",
        lookup.result
          ? `${lookup.result.found ? "Found" : "Not found"} · ${lookup.result.registrationStatus}`
          : "Pending",
      );
      if (lookup.result?.ownerName) line("Registry owner", lookup.result.ownerName);
    }

    // Voice testaments
    h("9. Voice testaments");
    if (snapshot.testaments.length === 0) {
      doc.text("No spoken statements recorded.");
    }
    for (const testament of snapshot.testaments) {
      doc.moveDown(0.4);
      doc
        .font(fonts.bold)
        .text(`${testament.title} (${spokenLanguageLabel(testament.language)})`)
        .font(fonts.regular);
      line(
        "Recorded",
        `${new Date(testament.createdAt).toLocaleString("en-KE")}${
          testament.recordedByAgent ? " · captured by family agent" : ""
        }`,
      );
      line("Transcript status", testament.transcriptStatus.replace(/_/g, " "));
      if (testament.transcript.trim()) {
        doc.moveDown(0.2);
        doc.fontSize(9).text(testament.transcript.trim());
        doc.fontSize(10);
      }
    }
    doc
      .moveDown(0.4)
      .font(fonts.oblique)
      .fontSize(9)
      .fillColor("#555555")
      .text(
        "Recordings evidence the testator's spoken intent. They support, and do not replace, the certified instruments above.",
      )
      .font(fonts.regular)
      .fontSize(10)
      .fillColor("#222222");

    // Seal attestation
    doc.addPage();
    h("10. Seal attestation");
    line("Sealed at", new Date(snapshot.sealedAt).toLocaleString("en-KE"));
    line("Advocate", snapshot.advocateName);
    if (snapshot.advocate?.advocateLicense) {
      line("LSK number", snapshot.advocate.advocateLicense);
    }
    line("Vault status", snapshot.vault.status);
    doc.moveDown(0.5);
    doc.font(fonts.bold).text("Recent audit (excerpt)");
    doc.font(fonts.regular).fontSize(9);
    for (const row of snapshot.auditLines) {
      doc.text(`• ${row}`);
    }
    doc.fontSize(10);

    // Embedded images appendix
    if (imageAttachments.length > 0) {
      doc.addPage();
      h("11. Embedded identity & deed images");
      for (const att of imageAttachments) {
        doc.moveDown(0.4);
        doc.font(fonts.bold).text(att.label);
        doc.font(fonts.regular);
        try {
          const maxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
          const maxHeight = 360;
          if (doc.y > doc.page.height - 200) doc.addPage();
          doc.image(att.bytes, {
            fit: [maxWidth, maxHeight],
            align: "center",
          });
          doc.moveDown(0.5);
        } catch {
          doc.fillColor("#880000").text(`(Could not embed image: ${att.label})`).fillColor("#222222");
        }
      }
    }

    doc.end();
  });
}

async function mergePdfAttachments(
  narrative: Buffer,
  pdfAttachments: Attachment[],
): Promise<{ buffer: Buffer; pageCount: number }> {
  const merged = await PdfLibDocument.load(narrative);
  for (const att of pdfAttachments) {
    try {
      const bytes = att.bytes;
      const src = await PdfLibDocument.load(bytes, { ignoreEncryption: true });
      const pages = await merged.copyPages(src, src.getPageIndices());
      // Cover page note before appended pages
      for (const page of pages) {
        merged.addPage(page);
      }
    } catch {
      // Skip unreadable PDFs; narrative still lists them by name
    }
  }
  const buffer = Buffer.from(await merged.save());
  return { buffer, pageCount: merged.getPageCount() };
}

async function buildSnapshot(input: {
  vaultId: string;
  reviewRequestId: string;
  version: number;
  advocateName: string;
  sealedAt: string;
}): Promise<Snapshot> {
  const vault = await getVaultById(input.vaultId);
  if (!vault) throw new Error("Vault not found for binder.");
  const owner = await findUserById(vault.ownerId);
  if (!owner) throw new Error("Vault owner not found for binder.");
  const review = await getReviewRequest(input.reviewRequestId);
  if (!review) throw new Error("Review not found for binder.");

  const advocate = review.advocateId
    ? (await findUserById(review.advocateId)) || null
    : null;

  const [
    assets,
    beneficiaries,
    allocations,
    documents,
    lookups,
    plan,
    testaments,
    audit,
  ] = await Promise.all([
    listAssets(input.vaultId),
    listBeneficiaries(input.vaultId),
    listAllocations(input.vaultId),
    listLegalDocumentsForReview(input.reviewRequestId),
    listTitleLookups(input.vaultId),
    getExecutionPlan(input.vaultId),
    listAudioTestaments(input.vaultId),
    listAudit(input.vaultId),
  ]);

  return {
    vault,
    owner,
    review,
    advocate,
    assets,
    beneficiaries,
    allocations,
    documents,
    lookups,
    plan,
    testaments,
    auditLines: audit.slice(0, 25).map(
      (a) =>
        `${new Date(a.createdAt).toLocaleString("en-KE")} — ${a.action}: ${a.detail}`,
    ),
    sealedAt: input.sealedAt,
    version: input.version,
    advocateName: input.advocateName || advocate?.fullName || "Partner advocate",
  };
}

async function writeBinderPdf(snapshot: Snapshot): Promise<{
  relativePath: string;
  documentName: string;
  fileHash: string;
  pageCount: number;
}> {
  const attachments = await collectAttachments(snapshot);
  const images = attachments.filter((a) => a.kind === "image");
  const pdfs = attachments.filter((a) => a.kind === "pdf");

  const narrativeBuffer = await writeNarrativePdf(snapshot, images);
  const final =
    pdfs.length > 0
      ? await mergePdfAttachments(narrativeBuffer, pdfs)
      : await (async () => {
          const loaded = await PdfLibDocument.load(narrativeBuffer);
          return {
            buffer: Buffer.from(await loaded.save()),
            pageCount: loaded.getPageCount(),
          };
        })();

  const documentName = `ShambaTrust-Binder-${snapshot.owner.fullName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 40)}-v${snapshot.version}.pdf`;
  const relativePath = `binders/${snapshot.vault.id}-v${snapshot.version}-${Date.now()}.pdf`;
  await writeStoredFile(relativePath, final.buffer, "application/pdf");

  const fileHash = createHash("sha256").update(final.buffer).digest("hex");
  return {
    relativePath,
    documentName,
    fileHash,
    pageCount: final.pageCount,
  };
}

/** Create generating record and build PDF for a newly sealed vault. */
export async function generateVaultBinderOnSeal(input: {
  vaultId: string;
  reviewRequestId: string;
  advocateUserId: string;
  advocateName: string;
}): Promise<void> {
  const sealedAt = new Date().toISOString();
  const binder = await createVaultBinderGenerating({
    vaultId: input.vaultId,
    reviewRequestId: input.reviewRequestId,
    advocateUserId: input.advocateUserId,
    advocateName: input.advocateName,
    sealedAt,
  });

  try {
    const snapshot = await buildSnapshot({
      vaultId: input.vaultId,
      reviewRequestId: input.reviewRequestId,
      version: binder.version,
      advocateName: input.advocateName,
      sealedAt,
    });
    const written = await writeBinderPdf(snapshot);
    await finalizeVaultBinder(binder.id, {
      documentPath: written.relativePath,
      documentName: written.documentName,
      fileHash: written.fileHash,
      pageCount: written.pageCount,
    });
    await addAudit({
      vaultId: input.vaultId,
      actorUserId: input.advocateUserId,
      action: "binder_generated",
      detail: `Sealed binder v${binder.version} ready (${written.pageCount} pages, sha256 ${written.fileHash.slice(0, 12)}…)`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Binder generation failed";
    await failVaultBinder(binder.id, message);
    await addAudit({
      vaultId: input.vaultId,
      actorUserId: input.advocateUserId,
      action: "binder_failed",
      detail: message,
    });
  }
}

/** Retry a failed binder (same version) from ops. */
export async function regenerateFailedVaultBinder(
  binderId: string,
  actorUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await getVaultBinder(binderId);
  if (!existing) return { ok: false, error: "Binder not found." };
  if (existing.status === "ready") {
    return { ok: false, error: "Ready binders are immutable. Re-seal after amendment for a new version." };
  }

  const binder = await resetVaultBinderGenerating(binderId);
  if (!binder) return { ok: false, error: "Could not reset binder." };

  try {
    const snapshot = await buildSnapshot({
      vaultId: binder.vaultId,
      reviewRequestId: binder.reviewRequestId,
      version: binder.version,
      advocateName: binder.advocateName,
      sealedAt: binder.sealedAt,
    });
    const written = await writeBinderPdf(snapshot);
    await finalizeVaultBinder(binder.id, {
      documentPath: written.relativePath,
      documentName: written.documentName,
      fileHash: written.fileHash,
      pageCount: written.pageCount,
    });
    await addAudit({
      vaultId: binder.vaultId,
      actorUserId: actorUserId,
      action: "binder_generated",
      detail: `Binder v${binder.version} regenerated by ops (${written.pageCount} pages)`,
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Binder generation failed";
    await failVaultBinder(binder.id, message);
    return { ok: false, error: message };
  }
}

export function binderAbsolutePath(relativePath: string): string {
  const key = relativePath.startsWith("binders/")
    ? relativePath
    : `binders/${relativePath}`;
  return key;
}
