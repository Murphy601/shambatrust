import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { normalizeKenyanPhone, phonesEqual } from "@/lib/auth/phone";
import { checklistForPackage } from "@/lib/advocate/checklist";
import { ELDER_CONSENT_VERSION } from "@/lib/db/types";
import type {
  AdvocateApplication,
  AdvocateApplicationStatus,
  AgentLink,
  Allocation,
  Asset,
  AuditEntry,
  Beneficiary,
  BillingKind,
  BillingRecord,
  CaseMessage,
  ChecklistItem,
  ConsultBooking,
  Database,
  ExecutionPlan,
  ExecutionTrustee,
  LegalDocument,
  LegalDocumentType,
  MarketingLead,
  OtpRecord,
  PendingChange,
  PublicStatusToken,
  ReviewRequest,
  SuccessionApproval,
  SuccessionCase,
  SuccessionCaseStatus,
  SupportSession,
  TitleLookupRecord,
  TitleLookupResult,
  User,
  Vault,
  VaultBinder,
  VaultSetupStep,
  VaultStatus,
} from "@/lib/db/types";
import { normalizeLskNumber } from "@/lib/advocate/lsk";
import { amountForBillingEvent } from "@/lib/ops/billing";
import { getOpsSeatRole } from "@/lib/ops/seats";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "db.json");

const emptyDb = (): Database => ({
  users: [],
  vaults: [],
  assets: [],
  beneficiaries: [],
  allocations: [],
  agentLinks: [],
  pendingChanges: [],
  reviewRequests: [],
  legalDocuments: [],
  titleLookups: [],
  executionPlans: [],
  successionCases: [],
  successionApprovals: [],
  advocateApplications: [],
  billingRecords: [],
  supportSessions: [],
  caseMessages: [],
  consultBookings: [],
  marketingLeads: [],
  publicStatusTokens: [],
  vaultBinders: [],
  otps: [],
  auditLog: [],
});

function normalizeReview(r: ReviewRequest): ReviewRequest {
  return {
    ...r,
    advocateId: r.advocateId ?? null,
    assignedAt: r.assignedAt ?? null,
    completedAt: r.completedAt ?? null,
    consultScheduledAt: r.consultScheduledAt ?? null,
    consultNotes: r.consultNotes ?? "",
    checklist:
      Array.isArray(r.checklist) && r.checklist.length > 0
        ? r.checklist
        : checklistForPackage(r.packageTier),
    consentAcceptedAt: r.consentAcceptedAt ?? null,
    consentVersion: r.consentVersion ?? null,
    docAccessRevokedAt: r.docAccessRevokedAt ?? null,
  };
}

async function ensureDb(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify(emptyDb(), null, 2), "utf8");
  }
}

export async function readDb(): Promise<Database> {
  await ensureDb();
  const raw = await fs.readFile(DB_PATH, "utf8");
  const parsed = JSON.parse(raw) as Partial<Database>;
  const db = { ...emptyDb(), ...parsed } as Database;
  db.users = (db.users || []).map((u) => ({
    ...u,
    email: u.email ?? null,
    idFrontName: u.idFrontName ?? null,
    idFrontPath: u.idFrontPath ?? null,
    idBackName: u.idBackName ?? null,
    idBackPath: u.idBackPath ?? null,
    address: u.address ?? "",
    county: u.county ?? "",
    // Legacy accounts skip re-KYC; new signups set this explicitly
    profileComplete: u.profileComplete !== false,
    advocateLicense: u.advocateLicense ?? null,
    opsSeat:
      u.opsSeat ??
      (u.role === "admin" ? getOpsSeatRole(u.phone) : null),
    advocateSuspended: Boolean(u.advocateSuspended),
    advocateMaxCases: u.advocateMaxCases ?? null,
    advocateOooUntil: u.advocateOooUntil ?? null,
    advocateOooNote: u.advocateOooNote ?? "",
  }));
  db.vaults = (db.vaults || []).map((v) => ({
    ...v,
    setupStep: (v.setupStep ||
      (v.status === "draft" ? "assets" : "submitted")) as VaultSetupStep,
    amendmentOpen: Boolean(v.amendmentOpen),
    amendmentOpenedAt: v.amendmentOpenedAt ?? null,
    statusBeforeAmendment: v.statusBeforeAmendment ?? null,
    amendmentFeeCharged: Boolean(v.amendmentFeeCharged),
    forceLocked: Boolean(v.forceLocked),
    opsNotes: v.opsNotes ?? "",
  }));
  db.titleLookups = (db.titleLookups || []).map((t) => ({
    ...t,
    reviewRequestId: t.reviewRequestId ?? null,
    costKes: t.costKes ?? amountForBillingEvent("title_lookup"),
  }));
  db.reviewRequests = (db.reviewRequests || []).map(normalizeReview);
  db.legalDocuments = db.legalDocuments || [];
  db.executionPlans = db.executionPlans || [];
  db.successionCases = db.successionCases || [];
  db.successionApprovals = db.successionApprovals || [];
  db.advocateApplications = db.advocateApplications || [];
  db.billingRecords = db.billingRecords || [];
  db.supportSessions = db.supportSessions || [];
  db.caseMessages = db.caseMessages || [];
  db.consultBookings = db.consultBookings || [];
  db.marketingLeads = db.marketingLeads || [];
  db.publicStatusTokens = db.publicStatusTokens || [];
  db.vaultBinders = db.vaultBinders || [];
  return db;
}

export async function writeDb(db: Database): Promise<void> {
  await ensureDb();
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export function newId(): string {
  return randomUUID();
}

export async function upsertOtp(record: OtpRecord): Promise<void> {
  const db = await readDb();
  db.otps = db.otps.filter(
    (o) => !(o.phone === record.phone && o.purpose === record.purpose),
  );
  db.otps.push(record);
  await writeDb(db);
}

export async function getOtp(
  phone: string,
  purpose: OtpRecord["purpose"],
): Promise<OtpRecord | undefined> {
  const db = await readDb();
  return db.otps.find((o) => o.phone === phone && o.purpose === purpose);
}

export async function clearOtp(
  phone: string,
  purpose: OtpRecord["purpose"],
): Promise<void> {
  const db = await readDb();
  db.otps = db.otps.filter(
    (o) => !(o.phone === phone && o.purpose === purpose),
  );
  await writeDb(db);
}

export async function findUserByPhone(phone: string): Promise<User | undefined> {
  const db = await readDb();
  return db.users.find((u) => u.phone === phone);
}

export async function findUserByEmail(
  email: string,
): Promise<User | undefined> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return undefined;
  const db = await readDb();
  return db.users.find((u) => u.email === normalized);
}

/** Resolve login identifier to a user (phone or email). */
export async function findUserByIdentifier(input: {
  phone?: string | null;
  email?: string | null;
}): Promise<User | undefined> {
  if (input.phone) {
    const phone = normalizeKenyanPhone(input.phone);
    if (phone) {
      const byPhone = await findUserByPhone(phone);
      if (byPhone) return byPhone;
    }
  }
  if (input.email) {
    return findUserByEmail(input.email);
  }
  return undefined;
}

export async function findUserById(id: string): Promise<User | undefined> {
  const db = await readDb();
  return db.users.find((u) => u.id === id);
}

export async function createUser(input: {
  phone: string;
  fullName: string;
  role: User["role"];
  locale?: User["locale"];
  advocateLicense?: string | null;
  email?: string | null;
  idFrontName?: string | null;
  idFrontPath?: string | null;
  idBackName?: string | null;
  idBackPath?: string | null;
  address?: string;
  county?: string;
  profileComplete?: boolean;
}): Promise<User> {
  const db = await readDb();
  const existing = db.users.find((u) => u.phone === input.phone);
  if (existing) return existing;

  const email = input.email?.trim().toLowerCase() || null;
  if (email) {
    const emailTaken = db.users.find((u) => u.email === email);
    if (emailTaken) {
      throw new Error("That email is already registered.");
    }
  }

  const user: User = {
    id: newId(),
    phone: input.phone,
    email,
    fullName: input.fullName || "ShambaTrust Member",
    role: input.role,
    locale: input.locale || "en",
    idFrontName: input.idFrontName ?? null,
    idFrontPath: input.idFrontPath ?? null,
    idBackName: input.idBackName ?? null,
    idBackPath: input.idBackPath ?? null,
    address: input.address?.trim() || "",
    county: input.county?.trim() || "",
    profileComplete: input.profileComplete !== false,
    advocateLicense: input.advocateLicense || null,
    opsSeat: input.role === "admin" ? getOpsSeatRole(input.phone) : null,
    advocateSuspended: false,
    advocateMaxCases: input.role === "advocate" ? 10 : null,
    advocateOooUntil: null,
    advocateOooNote: "",
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);

  if (input.role === "elder") {
    const vault: Vault = {
      id: newId(),
      ownerId: user.id,
      status: "draft",
      packageTier: null,
      binderRequested: true,
      setupStep: "assets",
      amendmentOpen: false,
      amendmentOpenedAt: null,
      statusBeforeAmendment: null,
      amendmentFeeCharged: false,
      forceLocked: false,
      opsNotes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.vaults.push(vault);
  }

  await writeDb(db);
  return user;
}

export async function getVaultForUser(userId: string): Promise<{
  vault: Vault;
  asAgent: boolean;
} | null> {
  const db = await readDb();
  const owned = db.vaults.find((v) => v.ownerId === userId);
  if (owned) return { vault: owned, asAgent: false };

  const link = db.agentLinks.find(
    (l) => l.agentUserId === userId && l.status === "active",
  );
  if (!link) return null;
  const vault = db.vaults.find((v) => v.id === link.vaultId);
  if (!vault) return null;
  return { vault, asAgent: true };
}

export async function listAssets(vaultId: string): Promise<Asset[]> {
  const db = await readDb();
  return db.assets.filter((a) => a.vaultId === vaultId);
}

export async function getAsset(
  vaultId: string,
  assetId: string,
): Promise<Asset | undefined> {
  const db = await readDb();
  return db.assets.find((a) => a.vaultId === vaultId && a.id === assetId);
}

export async function saveAsset(
  asset: Omit<Asset, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<Asset> {
  const db = await readDb();
  const now = new Date().toISOString();
  if (asset.id) {
    const idx = db.assets.findIndex((a) => a.id === asset.id);
    if (idx >= 0) {
      const updated: Asset = {
        ...db.assets[idx],
        ...asset,
        id: asset.id,
        updatedAt: now,
      };
      db.assets[idx] = updated;
      await touchVault(db, asset.vaultId);
      await writeDb(db);
      return updated;
    }
  }
  const created: Asset = {
    id: newId(),
    vaultId: asset.vaultId,
    type: asset.type,
    title: asset.title,
    notes: asset.notes || "",
    documentName: asset.documentName,
    documentPath: asset.documentPath,
    titleNumber: asset.titleNumber || "",
    county: asset.county || "",
    subCounty: asset.subCounty || "",
    landmark: asset.landmark || "",
    gpsLat: asset.gpsLat ?? null,
    gpsLng: asset.gpsLng ?? null,
    registrationNumber: asset.registrationNumber || "",
    makeModel: asset.makeModel || "",
    year: asset.year || "",
    bankName: asset.bankName || "",
    accountNumber: asset.accountNumber || "",
    accountType: asset.accountType || "",
    businessRegNumber: asset.businessRegNumber || "",
    kraPin: asset.kraPin || "",
    createdAt: now,
    updatedAt: now,
  };
  db.assets.push(created);
  await advanceSetupStep(db, asset.vaultId, "heirs");
  await touchVault(db, asset.vaultId);
  await writeDb(db);
  return created;
}

export async function deleteAsset(
  vaultId: string,
  assetId: string,
): Promise<boolean> {
  const db = await readDb();
  const before = db.assets.length;
  db.assets = db.assets.filter(
    (a) => !(a.vaultId === vaultId && a.id === assetId),
  );
  db.allocations = db.allocations.filter((a) => a.assetId !== assetId);
  if (db.assets.length === before) return false;
  await touchVault(db, vaultId);
  await writeDb(db);
  return true;
}

export async function listBeneficiaries(
  vaultId: string,
): Promise<Beneficiary[]> {
  const db = await readDb();
  return db.beneficiaries.filter((b) => b.vaultId === vaultId);
}

export async function saveBeneficiary(
  input: Omit<Beneficiary, "id" | "createdAt"> & { id?: string },
): Promise<Beneficiary> {
  const db = await readDb();
  const phone = input.phone.trim()
    ? normalizeKenyanPhone(input.phone) || input.phone.trim()
    : "";
  const payload = {
    fullName: input.fullName,
    idNumber: input.idNumber,
    phone,
    relationship: input.relationship,
  };
  if (input.id) {
    const idx = db.beneficiaries.findIndex(
      (b) => b.id === input.id && b.vaultId === input.vaultId,
    );
    if (idx >= 0) {
      db.beneficiaries[idx] = {
        ...db.beneficiaries[idx],
        ...payload,
        id: input.id,
        vaultId: input.vaultId,
      };
      await advanceSetupStep(db, input.vaultId, "allocations");
      await touchVault(db, input.vaultId);
      await writeDb(db);
      return db.beneficiaries[idx];
    }
  }
  const created: Beneficiary = {
    id: newId(),
    vaultId: input.vaultId,
    ...payload,
    createdAt: new Date().toISOString(),
  };
  db.beneficiaries.push(created);
  await advanceSetupStep(db, input.vaultId, "allocations");
  await touchVault(db, input.vaultId);
  await writeDb(db);
  return created;
}

export async function deleteBeneficiary(
  vaultId: string,
  beneficiaryId: string,
): Promise<boolean> {
  const db = await readDb();
  const before = db.beneficiaries.length;
  db.beneficiaries = db.beneficiaries.filter(
    (b) => !(b.vaultId === vaultId && b.id === beneficiaryId),
  );
  db.allocations = db.allocations.filter(
    (a) => a.beneficiaryId !== beneficiaryId,
  );
  if (db.beneficiaries.length === before) return false;
  await touchVault(db, vaultId);
  await writeDb(db);
  return true;
}

export async function listAllocations(vaultId: string): Promise<Allocation[]> {
  const db = await readDb();
  return db.allocations.filter((a) => a.vaultId === vaultId);
}

export async function replaceAllocations(
  vaultId: string,
  allocations: Omit<Allocation, "id" | "createdAt" | "vaultId">[],
): Promise<Allocation[]> {
  const db = await readDb();
  db.allocations = db.allocations.filter((a) => a.vaultId !== vaultId);
  const created = allocations.map((a) => ({
    id: newId(),
    vaultId,
    beneficiaryId: a.beneficiaryId,
    assetId: a.assetId,
    percentage: a.percentage,
    specificGift: a.specificGift,
    createdAt: new Date().toISOString(),
  }));
  db.allocations.push(...created);
  if (created.length > 0) {
    await advanceSetupStep(db, vaultId, "ready_for_review");
  }
  await touchVault(db, vaultId);
  await writeDb(db);
  return created;
}

export async function inviteAgent(
  vaultId: string,
  elderUserId: string,
  agentPhone: string,
): Promise<AgentLink> {
  const db = await readDb();
  const existing = db.agentLinks.find(
    (l) =>
      l.vaultId === vaultId &&
      l.agentPhone === agentPhone &&
      l.status !== "revoked",
  );
  if (existing) return existing;

  const agent = db.users.find((u) => u.phone === agentPhone);
  const link: AgentLink = {
    id: newId(),
    vaultId,
    elderUserId,
    agentUserId: agent?.id || null,
    agentPhone,
    status: agent ? "active" : "pending",
    createdAt: new Date().toISOString(),
  };
  db.agentLinks.push(link);
  await writeDb(db);
  return link;
}

export async function activateAgentLinksForUser(user: User): Promise<void> {
  const db = await readDb();
  let changed = false;
  for (const link of db.agentLinks) {
    if (link.agentPhone === user.phone && link.status === "pending") {
      link.agentUserId = user.id;
      link.status = "active";
      if (user.role !== "agent") {
        const u = db.users.find((x) => x.id === user.id);
        if (u) u.role = "agent";
      }
      changed = true;
    }
  }
  if (changed) await writeDb(db);
}

export async function listAgentLinks(vaultId: string): Promise<AgentLink[]> {
  const db = await readDb();
  return db.agentLinks.filter((l) => l.vaultId === vaultId);
}

export async function createPendingChange(
  input: Omit<PendingChange, "id" | "createdAt" | "status">,
): Promise<PendingChange> {
  const db = await readDb();
  const change: PendingChange = {
    id: newId(),
    ...input,
    status: "pending_elder_otp",
    createdAt: new Date().toISOString(),
  };
  db.pendingChanges.push(change);
  await writeDb(db);
  return change;
}

export async function getPendingChange(
  id: string,
): Promise<PendingChange | undefined> {
  const db = await readDb();
  return db.pendingChanges.find((c) => c.id === id);
}

export async function markPendingChange(
  id: string,
  status: PendingChange["status"],
): Promise<void> {
  const db = await readDb();
  const change = db.pendingChanges.find((c) => c.id === id);
  if (!change) return;
  change.status = status;
  await writeDb(db);
}

export async function createReviewRequest(
  input: Pick<
    ReviewRequest,
    "vaultId" | "packageTier" | "consultMode" | "notes"
  > & {
    consentAccepted: boolean;
  },
): Promise<ReviewRequest> {
  if (!input.consentAccepted) {
    throw new Error("Elder consent is required before submitting for review.");
  }
  const db = await readDb();
  const now = new Date().toISOString();
  const request: ReviewRequest = {
    id: newId(),
    vaultId: input.vaultId,
    packageTier: input.packageTier,
    consultMode: input.consultMode,
    notes: input.notes,
    status: "submitted",
    advocateId: null,
    assignedAt: null,
    completedAt: null,
    consultScheduledAt: null,
    consultNotes: "",
    checklist: checklistForPackage(input.packageTier),
    consentAcceptedAt: now,
    consentVersion: ELDER_CONSENT_VERSION,
    docAccessRevokedAt: null,
    createdAt: now,
  };
  db.reviewRequests.push(request);
  const vault = db.vaults.find((v) => v.id === input.vaultId);
  if (vault) {
    vault.status = "pending_review";
    vault.packageTier = input.packageTier;
    vault.setupStep = "submitted";
    vault.amendmentOpen = false;
    vault.amendmentOpenedAt = null;
    vault.statusBeforeAmendment = null;
    vault.amendmentFeeCharged = false;
    vault.updatedAt = now;
  }
  await writeDb(db);
  return request;
}

export async function openVaultAmendment(input: {
  vaultId: string;
  reason: string;
  free: boolean;
}): Promise<Vault> {
  const db = await readDb();
  const vault = db.vaults.find((v) => v.id === input.vaultId);
  if (!vault) throw new Error("Vault not found.");
  if (vault.amendmentOpen) return vault;
  if (vault.status === "draft" && !vault.amendmentOpen) {
    throw new Error("Vault is already editable as a draft.");
  }

  const now = new Date().toISOString();
  vault.statusBeforeAmendment = vault.status;
  vault.amendmentOpen = true;
  vault.amendmentOpenedAt = now;
  vault.amendmentFeeCharged = !input.free;
  vault.status = "draft";
  vault.setupStep = "ready_for_review";
  vault.updatedAt = now;
  await writeDb(db);
  return vault;
}

export async function getLatestReviewSubmitAt(
  vaultId: string,
): Promise<string | null> {
  const reviews = await listReviewRequests(vaultId);
  if (reviews.length === 0) return null;
  const sorted = [...reviews].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  return sorted[0]?.createdAt ?? null;
}

export async function listReviewRequests(
  vaultId: string,
): Promise<ReviewRequest[]> {
  const db = await readDb();
  return db.reviewRequests
    .filter((r) => r.vaultId === vaultId)
    .map(normalizeReview);
}

export async function listAllReviewRequests(): Promise<ReviewRequest[]> {
  const db = await readDb();
  return db.reviewRequests
    .map(normalizeReview)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getReviewRequest(
  id: string,
): Promise<ReviewRequest | undefined> {
  const db = await readDb();
  const found = db.reviewRequests.find((r) => r.id === id);
  return found ? normalizeReview(found) : undefined;
}

export async function assignReviewRequest(
  reviewId: string,
  advocateId: string,
): Promise<ReviewRequest | null> {
  const db = await readDb();
  const review = db.reviewRequests.find((r) => r.id === reviewId);
  if (!review) return null;
  if (review.status === "completed") return normalizeReview(review);

  review.advocateId = advocateId;
  review.status = "assigned";
  review.assignedAt = new Date().toISOString();
  if (!review.checklist?.length) {
    review.checklist = checklistForPackage(review.packageTier);
  }

  const vault = db.vaults.find((v) => v.id === review.vaultId);
  if (vault && vault.status !== "sealed") {
    vault.status = "in_review";
    vault.updatedAt = new Date().toISOString();
  }

  await writeDb(db);
  return normalizeReview(review);
}

export async function updateReviewRequest(
  reviewId: string,
  patch: {
    checklist?: ChecklistItem[];
    consultScheduledAt?: string | null;
    consultNotes?: string;
    notes?: string;
  },
): Promise<ReviewRequest | null> {
  const db = await readDb();
  const review = db.reviewRequests.find((r) => r.id === reviewId);
  if (!review) return null;

  if (patch.checklist) review.checklist = patch.checklist;
  if (patch.consultScheduledAt !== undefined) {
    review.consultScheduledAt = patch.consultScheduledAt;
  }
  if (patch.consultNotes !== undefined) review.consultNotes = patch.consultNotes;
  if (patch.notes !== undefined) review.notes = patch.notes;

  await writeDb(db);
  return normalizeReview(review);
}

export async function completeReviewRequest(
  reviewId: string,
): Promise<ReviewRequest | null> {
  const db = await readDb();
  const review = db.reviewRequests.find((r) => r.id === reviewId);
  if (!review) return null;

  const now = new Date().toISOString();
  review.status = "completed";
  review.completedAt = now;
  review.docAccessRevokedAt = now;

  const vault = db.vaults.find((v) => v.id === review.vaultId);
  if (vault) {
    vault.status = "sealed";
    vault.updatedAt = now;
  }

  await writeDb(db);
  return normalizeReview(review);
}

export async function getVaultById(vaultId: string): Promise<Vault | undefined> {
  const db = await readDb();
  return db.vaults.find((v) => v.id === vaultId);
}

export async function listLegalDocuments(
  vaultId: string,
): Promise<LegalDocument[]> {
  const db = await readDb();
  return db.legalDocuments
    .filter((d) => d.vaultId === vaultId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listLegalDocumentsForReview(
  reviewRequestId: string,
): Promise<LegalDocument[]> {
  const db = await readDb();
  return db.legalDocuments
    .filter((d) => d.reviewRequestId === reviewRequestId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getLegalDocument(
  id: string,
): Promise<LegalDocument | undefined> {
  const db = await readDb();
  return db.legalDocuments.find((d) => d.id === id);
}

export async function saveLegalDocument(input: {
  id?: string;
  reviewRequestId: string;
  vaultId: string;
  type: LegalDocumentType;
  title: string;
  body: string;
  status?: LegalDocument["status"];
  documentName?: string | null;
  documentPath?: string | null;
}): Promise<LegalDocument> {
  const db = await readDb();
  const now = new Date().toISOString();

  if (input.id) {
    const idx = db.legalDocuments.findIndex((d) => d.id === input.id);
    if (idx >= 0) {
      const updated: LegalDocument = {
        ...db.legalDocuments[idx],
        type: input.type,
        title: input.title,
        body: input.body,
        status: input.status || db.legalDocuments[idx].status,
        documentName:
          input.documentName !== undefined
            ? input.documentName
            : db.legalDocuments[idx].documentName,
        documentPath:
          input.documentPath !== undefined
            ? input.documentPath
            : db.legalDocuments[idx].documentPath,
        updatedAt: now,
      };
      db.legalDocuments[idx] = updated;
      await writeDb(db);
      return updated;
    }
  }

  const created: LegalDocument = {
    id: newId(),
    reviewRequestId: input.reviewRequestId,
    vaultId: input.vaultId,
    type: input.type,
    status: input.status || "draft",
    title: input.title,
    body: input.body,
    documentName: input.documentName || null,
    documentPath: input.documentPath || null,
    signatureName: null,
    signedAt: null,
    signedByUserId: null,
    createdAt: now,
    updatedAt: now,
  };
  db.legalDocuments.push(created);
  await writeDb(db);
  return created;
}

export async function signLegalDocument(input: {
  documentId: string;
  advocateUserId: string;
  signatureName: string;
  documentName?: string | null;
  documentPath?: string | null;
}): Promise<LegalDocument | null> {
  const db = await readDb();
  const doc = db.legalDocuments.find((d) => d.id === input.documentId);
  if (!doc) return null;

  const now = new Date().toISOString();
  doc.status = input.documentPath ? "certified" : "signed";
  doc.signatureName = input.signatureName;
  doc.signedAt = now;
  doc.signedByUserId = input.advocateUserId;
  if (input.documentName !== undefined) doc.documentName = input.documentName;
  if (input.documentPath !== undefined) doc.documentPath = input.documentPath;
  doc.updatedAt = now;

  await writeDb(db);
  return doc;
}

export async function saveTitleLookup(input: {
  vaultId: string;
  assetId: string | null;
  titleNumber: string;
  county: string;
  result: TitleLookupResult;
  requestedByUserId: string;
  reviewRequestId?: string | null;
  costKes?: number;
}): Promise<TitleLookupRecord> {
  const db = await readDb();
  const costKes = input.costKes ?? amountForBillingEvent("title_lookup");
  const record: TitleLookupRecord = {
    id: newId(),
    vaultId: input.vaultId,
    assetId: input.assetId,
    reviewRequestId: input.reviewRequestId ?? null,
    titleNumber: input.titleNumber,
    county: input.county,
    result: input.result,
    requestedByUserId: input.requestedByUserId,
    costKes,
    createdAt: new Date().toISOString(),
  };
  db.titleLookups.push(record);
  db.billingRecords.push({
    id: newId(),
    vaultId: input.vaultId,
    actorUserId: input.requestedByUserId,
    kind: "title_lookup",
    detail: `Title ${input.titleNumber || "(none)"} · ${input.county}`,
    amountKes: costKes,
    paid: false,
    paidAt: null,
    paidByUserId: null,
    relatedId: record.id,
    createdAt: record.createdAt,
  });
  await writeDb(db);
  return record;
}

export async function listAllTitleLookups(): Promise<TitleLookupRecord[]> {
  const db = await readDb();
  return [...db.titleLookups].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function listTitleLookups(
  vaultId: string,
): Promise<TitleLookupRecord[]> {
  const db = await readDb();
  return db.titleLookups
    .filter((t) => t.vaultId === vaultId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addAudit(
  entry: Omit<AuditEntry, "id" | "createdAt">,
): Promise<void> {
  const db = await readDb();
  db.auditLog.push({
    id: newId(),
    ...entry,
    createdAt: new Date().toISOString(),
  });
  await writeDb(db);
}

export async function listAudit(vaultId: string): Promise<AuditEntry[]> {
  const db = await readDb();
  return db.auditLog
    .filter((a) => a.vaultId === vaultId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listAllAudit(limit = 200): Promise<AuditEntry[]> {
  const db = await readDb();
  return [...db.auditLog]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function listEldersNewestFirst(): Promise<
  Array<{
    user: User;
    vault: Vault | null;
  }>
> {
  const db = await readDb();
  const elders = db.users
    .filter((u) => u.role === "elder")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return elders.map((user) => ({
    user,
    vault: db.vaults.find((v) => v.ownerId === user.id) || null,
  }));
}

export async function listAllUsers(): Promise<User[]> {
  const db = await readDb();
  return [...db.users].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listAllVaults(): Promise<Vault[]> {
  const db = await readDb();
  return [...db.vaults].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function ensureAdminUser(input: {
  phone: string;
  fullName: string;
}): Promise<User> {
  const db = await readDb();
  const existing = db.users.find((u) => u.phone === input.phone);
  if (existing) {
    existing.role = "admin";
    if (input.fullName.trim()) existing.fullName = input.fullName.trim();
    existing.advocateLicense = existing.advocateLicense ?? null;
    existing.opsSeat = getOpsSeatRole(input.phone) || "super";
    await writeDb(db);
    return existing;
  }
  const user: User = {
    id: newId(),
    phone: input.phone,
    email: null,
    fullName: input.fullName.trim() || "ShambaTrust Ops",
    role: "admin",
    locale: "en",
    idFrontName: null,
    idFrontPath: null,
    idBackName: null,
    idBackPath: null,
    address: "",
    county: "",
    profileComplete: true,
    advocateLicense: null,
    opsSeat: getOpsSeatRole(input.phone) || "super",
    advocateSuspended: false,
    advocateMaxCases: null,
    advocateOooUntil: null,
    advocateOooNote: "",
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  await writeDb(db);
  return user;
}

export function defaultExecutionPlan(
  vaultId: string,
  userId: string,
): Omit<ExecutionPlan, "id"> {
  return {
    vaultId,
    triggerType: "upon_death",
    trustees: [],
    minTrusteeApprovals: 2,
    requireDeathCertificate: true,
    coolingHours: 48,
    updatedAt: new Date().toISOString(),
    updatedByUserId: userId,
  };
}

export async function getExecutionPlan(
  vaultId: string,
): Promise<ExecutionPlan | null> {
  const db = await readDb();
  return db.executionPlans.find((p) => p.vaultId === vaultId) || null;
}

export async function saveExecutionPlan(input: {
  vaultId: string;
  trustees: ExecutionTrustee[];
  minTrusteeApprovals: number;
  requireDeathCertificate: boolean;
  coolingHours: number;
  updatedByUserId: string;
}): Promise<ExecutionPlan> {
  const db = await readDb();
  const now = new Date().toISOString();
  const existing = db.executionPlans.find((p) => p.vaultId === input.vaultId);
  if (existing) {
    existing.trustees = input.trustees;
    existing.minTrusteeApprovals = input.minTrusteeApprovals;
    existing.requireDeathCertificate = input.requireDeathCertificate;
    existing.coolingHours = input.coolingHours;
    existing.updatedAt = now;
    existing.updatedByUserId = input.updatedByUserId;
    await writeDb(db);
    return existing;
  }
  const created: ExecutionPlan = {
    id: newId(),
    vaultId: input.vaultId,
    triggerType: "upon_death",
    trustees: input.trustees,
    minTrusteeApprovals: input.minTrusteeApprovals,
    requireDeathCertificate: input.requireDeathCertificate,
    coolingHours: input.coolingHours,
    updatedAt: now,
    updatedByUserId: input.updatedByUserId,
  };
  db.executionPlans.push(created);
  await writeDb(db);
  return created;
}

export async function getSuccessionCase(
  id: string,
): Promise<SuccessionCase | undefined> {
  const db = await readDb();
  return db.successionCases.find((c) => c.id === id);
}

export async function listSuccessionCasesForVault(
  vaultId: string,
): Promise<SuccessionCase[]> {
  const db = await readDb();
  return db.successionCases
    .filter((c) => c.vaultId === vaultId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listAllSuccessionCases(): Promise<SuccessionCase[]> {
  const db = await readDb();
  return [...db.successionCases].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function listApprovalsForCase(
  caseId: string,
): Promise<SuccessionApproval[]> {
  const db = await readDb();
  return db.successionApprovals.filter((a) => a.caseId === caseId);
}

export async function createSuccessionCase(input: {
  vaultId: string;
  filedByUserId: string;
  deathDate: string;
  deathCertificateName: string | null;
  deathCertificatePath: string | null;
  filerNotes: string;
  trustees: ExecutionTrustee[];
  minTrusteeApprovals: number;
}): Promise<{ case: SuccessionCase; approvals: SuccessionApproval[] }> {
  const db = await readDb();
  const open = db.successionCases.find(
    (c) =>
      c.vaultId === input.vaultId &&
      c.status !== "succession_completed" &&
      c.status !== "succession_rejected",
  );
  if (open) {
    throw new Error("An open succession claim already exists for this vault.");
  }

  const now = new Date().toISOString();
  const hasTrustees = input.trustees.length > 0;
  const status: SuccessionCaseStatus = hasTrustees
    ? "awaiting_trustee_otps"
    : "pending_ops_verification";

  const created: SuccessionCase = {
    id: newId(),
    vaultId: input.vaultId,
    filedByUserId: input.filedByUserId,
    status,
    deathDate: input.deathDate,
    deathCertificateName: input.deathCertificateName,
    deathCertificatePath: input.deathCertificatePath,
    filerNotes: input.filerNotes,
    opsReviewedByUserId: null,
    opsDecisionAt: null,
    opsNotes: "",
    advocateId: null,
    coolingEndsAt: null,
    createdAt: now,
    updatedAt: now,
  };
  db.successionCases.push(created);

  const approvals: SuccessionApproval[] = input.trustees.map((t) => ({
    id: newId(),
    caseId: created.id,
    trusteePhone: t.phone,
    trusteeName: t.fullName,
    status: "pending" as const,
    approvedAt: null,
    userId: null,
  }));
  db.successionApprovals.push(...approvals);

  // If no trustees configured, go straight to ops
  if (!hasTrustees) {
    created.status = "pending_ops_verification";
  }

  await writeDb(db);
  return { case: created, approvals };
}

export async function approveSuccessionTrustee(input: {
  caseId: string;
  trusteePhone: string;
  userId: string;
}): Promise<{
  approval: SuccessionApproval;
  successionCase: SuccessionCase;
  approvedCount: number;
  required: number;
}> {
  const db = await readDb();
  const successionCase = db.successionCases.find((c) => c.id === input.caseId);
  if (!successionCase) throw new Error("Succession case not found.");

  if (
    successionCase.status !== "awaiting_trustee_otps" &&
    successionCase.status !== "succession_filed"
  ) {
    throw new Error("This claim is not waiting for trustee approvals.");
  }

  const approval = db.successionApprovals.find(
    (a) =>
      a.caseId === input.caseId &&
      a.trusteePhone === input.trusteePhone &&
      a.status === "pending",
  );
  if (!approval) throw new Error("No pending approval for this trustee phone.");

  const now = new Date().toISOString();
  approval.status = "approved";
  approval.approvedAt = now;
  approval.userId = input.userId;

  const plan = db.executionPlans.find(
    (p) => p.vaultId === successionCase.vaultId,
  );
  const required = plan?.minTrusteeApprovals || 1;
  const approvedCount = db.successionApprovals.filter(
    (a) => a.caseId === input.caseId && a.status === "approved",
  ).length;

  if (approvedCount >= required) {
    successionCase.status = "pending_ops_verification";
    successionCase.updatedAt = now;
  } else {
    successionCase.status = "awaiting_trustee_otps";
    successionCase.updatedAt = now;
  }

  await writeDb(db);
  return { approval, successionCase, approvedCount, required };
}

export async function opsDecideSuccession(input: {
  caseId: string;
  adminUserId: string;
  decision: "approve" | "reject";
  opsNotes: string;
}): Promise<SuccessionCase> {
  const db = await readDb();
  const successionCase = db.successionCases.find((c) => c.id === input.caseId);
  if (!successionCase) throw new Error("Succession case not found.");

  if (successionCase.status !== "pending_ops_verification") {
    throw new Error("Case is not pending ops verification.");
  }

  const now = new Date().toISOString();
  successionCase.opsReviewedByUserId = input.adminUserId;
  successionCase.opsDecisionAt = now;
  successionCase.opsNotes = input.opsNotes;
  successionCase.updatedAt = now;

  if (input.decision === "reject") {
    successionCase.status = "succession_rejected";
  } else {
    const plan = db.executionPlans.find(
      (p) => p.vaultId === successionCase.vaultId,
    );
    const hours = plan?.coolingHours ?? 48;
    successionCase.status = "succession_verified";
    successionCase.coolingEndsAt = new Date(
      Date.now() + hours * 60 * 60 * 1000,
    ).toISOString();
  }

  await writeDb(db);
  return successionCase;
}

export async function advocateClaimSuccession(input: {
  caseId: string;
  advocateId: string;
}): Promise<SuccessionCase> {
  const db = await readDb();
  const successionCase = db.successionCases.find((c) => c.id === input.caseId);
  if (!successionCase) throw new Error("Succession case not found.");

  if (
    successionCase.status !== "succession_verified" &&
    successionCase.status !== "with_advocate"
  ) {
    throw new Error("Case is not available for advocate handoff.");
  }

  if (
    successionCase.coolingEndsAt &&
    new Date(successionCase.coolingEndsAt).getTime() > Date.now() &&
    successionCase.status === "succession_verified"
  ) {
    throw new Error(
      `Cooling period active until ${new Date(successionCase.coolingEndsAt).toLocaleString()}.`,
    );
  }

  if (
    successionCase.advocateId &&
    successionCase.advocateId !== input.advocateId
  ) {
    throw new Error("Already assigned to another advocate.");
  }

  const now = new Date().toISOString();
  successionCase.advocateId = input.advocateId;
  successionCase.status = "with_advocate";
  successionCase.updatedAt = now;
  await writeDb(db);
  return successionCase;
}

export async function completeSuccessionCase(input: {
  caseId: string;
  advocateId: string;
  notes?: string;
}): Promise<SuccessionCase> {
  const db = await readDb();
  const successionCase = db.successionCases.find((c) => c.id === input.caseId);
  if (!successionCase) throw new Error("Succession case not found.");
  if (successionCase.advocateId !== input.advocateId) {
    throw new Error("Only the assigned advocate can complete this case.");
  }
  if (successionCase.status !== "with_advocate") {
    throw new Error("Case is not in advocate work status.");
  }

  const now = new Date().toISOString();
  successionCase.status = "succession_completed";
  successionCase.updatedAt = now;
  if (input.notes) {
    successionCase.opsNotes = `${successionCase.opsNotes}\nAdvocate: ${input.notes}`.trim();
  }
  await writeDb(db);
  return successionCase;
}

export async function userCanFileSuccession(input: {
  userId: string;
  phone: string;
  vaultId: string;
}): Promise<boolean> {
  const db = await readDb();
  const vault = db.vaults.find((v) => v.id === input.vaultId);
  if (!vault || vault.status !== "sealed") return false;

  // Owner cannot file their own death claim
  if (vault.ownerId === input.userId) return false;

  const plan = db.executionPlans.find((p) => p.vaultId === input.vaultId);
  if (plan?.trustees.some((t) => phonesEqual(t.phone, input.phone))) return true;

  const heir = db.beneficiaries.find(
    (b) => b.vaultId === input.vaultId && phonesEqual(b.phone, input.phone),
  );
  if (heir) return true;

  const agent = db.agentLinks.find(
    (l) =>
      l.vaultId === input.vaultId &&
      l.status === "active" &&
      (l.agentUserId === input.userId || phonesEqual(l.agentPhone, input.phone)),
  );
  if (agent) return true;

  return false;
}

const SETUP_STEP_ORDER: VaultSetupStep[] = [
  "assets",
  "heirs",
  "allocations",
  "ready_for_review",
  "submitted",
];

async function advanceSetupStep(
  db: Database,
  vaultId: string,
  atLeast: VaultSetupStep,
): Promise<void> {
  const vault = db.vaults.find((v) => v.id === vaultId);
  if (!vault || vault.status !== "draft") return;
  const current = SETUP_STEP_ORDER.indexOf(vault.setupStep || "assets");
  const target = SETUP_STEP_ORDER.indexOf(atLeast);
  if (target > current) vault.setupStep = atLeast;
}

async function touchVault(db: Database, vaultId: string): Promise<void> {
  const vault = db.vaults.find((v) => v.id === vaultId);
  if (vault) vault.updatedAt = new Date().toISOString();
}

export async function listAdvocateApplications(): Promise<AdvocateApplication[]> {
  const db = await readDb();
  return [...db.advocateApplications].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function getAdvocateApplication(
  id: string,
): Promise<AdvocateApplication | undefined> {
  const db = await readDb();
  return db.advocateApplications.find((a) => a.id === id);
}

export async function createAdvocateApplication(
  input: Omit<
    AdvocateApplication,
    | "id"
    | "status"
    | "adminNotes"
    | "reviewedByUserId"
    | "reviewedAt"
    | "createdUserId"
    | "createdAt"
    | "updatedAt"
  >,
): Promise<AdvocateApplication> {
  const db = await readDb();
  const phone = normalizeKenyanPhone(input.phone) || input.phone;
  const lskNumber = normalizeLskNumber(input.lskNumber);

  const duplicatePending = db.advocateApplications.find(
    (a) =>
      (a.phone === phone || normalizeLskNumber(a.lskNumber) === lskNumber) &&
      (a.status === "pending" || a.status === "needs_info"),
  );
  if (duplicatePending) {
    throw new Error(
      "An open application already exists for this phone or LSK number.",
    );
  }

  const now = new Date().toISOString();
  const created: AdvocateApplication = {
    id: newId(),
    fullName: input.fullName.trim(),
    phone,
    email: input.email.trim().toLowerCase(),
    lskNumber,
    idFrontName: input.idFrontName,
    idFrontPath: input.idFrontPath,
    idBackName: input.idBackName,
    idBackPath: input.idBackPath,
    lskCertName: input.lskCertName,
    lskCertPath: input.lskCertPath,
    officeAddress: input.officeAddress.trim(),
    lawFirm: input.lawFirm.trim(),
    organization: input.organization.trim(),
    status: "pending",
    adminNotes: "",
    reviewedByUserId: null,
    reviewedAt: null,
    createdUserId: null,
    createdAt: now,
    updatedAt: now,
  };
  db.advocateApplications.push(created);
  await writeDb(db);
  return created;
}

export async function reviewAdvocateApplication(input: {
  applicationId: string;
  decision: Exclude<AdvocateApplicationStatus, "pending">;
  adminNotes: string;
  reviewedByUserId: string;
}): Promise<{
  application: AdvocateApplication;
  user: User | null;
}> {
  const db = await readDb();
  const app = db.advocateApplications.find((a) => a.id === input.applicationId);
  if (!app) throw new Error("Application not found.");

  const now = new Date().toISOString();
  app.status = input.decision;
  app.adminNotes = input.adminNotes.trim();
  app.reviewedByUserId = input.reviewedByUserId;
  app.reviewedAt = now;
  app.updatedAt = now;

  let user: User | null = null;

  if (input.decision === "approved") {
    const existing = db.users.find((u) => u.phone === app.phone);
    if (existing) {
      if (existing.role !== "advocate" && existing.role !== "admin") {
        throw new Error(
          `Phone ${app.phone} is already registered as ${existing.role}. Resolve that account before approving.`,
        );
      }
      existing.role = "advocate";
      existing.fullName = app.fullName;
      existing.advocateLicense = app.lskNumber;
      existing.advocateSuspended = false;
      if (existing.advocateMaxCases == null) existing.advocateMaxCases = 10;
      user = existing;
    } else {
      user = {
        id: newId(),
        phone: app.phone,
        email: app.email || null,
        fullName: app.fullName,
        role: "advocate",
        locale: "en",
        idFrontName: app.idFrontName || null,
        idFrontPath: app.idFrontPath || null,
        idBackName: app.idBackName || null,
        idBackPath: app.idBackPath || null,
        address: app.officeAddress || "",
        county: "",
        profileComplete: true,
        advocateLicense: app.lskNumber,
        opsSeat: null,
        advocateSuspended: false,
        advocateMaxCases: 10,
        advocateOooUntil: null,
        advocateOooNote: "",
        createdAt: now,
      };
      db.users.push(user);
    }
    app.createdUserId = user.id;
  }

  await writeDb(db);
  return { application: app, user };
}

/** Approved advocate portal login: phone + matching LSK. */
export async function findApprovedAdvocate(
  phone: string,
  lskNumber: string,
): Promise<User | null> {
  const db = await readDb();
  const normalizedPhone = normalizeKenyanPhone(phone) || phone;
  const user = db.users.find(
    (u) => u.phone === normalizedPhone && u.role === "advocate",
  );
  if (!user?.advocateLicense) return null;
  if (user.advocateSuspended) return null;
  if (
    normalizeLskNumber(user.advocateLicense) !== normalizeLskNumber(lskNumber)
  ) {
    return null;
  }

  const appsForPhone = db.advocateApplications.filter(
    (a) => a.phone === normalizedPhone,
  );
  if (appsForPhone.length === 0) {
    // Legacy advocate accounts created before the application flow
    return user;
  }
  const approved = appsForPhone.some((a) => a.status === "approved");
  return approved ? user : null;
}

export function uploadsDir(): string {
  return path.join(DATA_DIR, "uploads");
}

export function advocateUploadsDir(): string {
  return path.join(DATA_DIR, "uploads", "advocate-apps");
}

export function elderSignupUploadsDir(): string {
  return path.join(DATA_DIR, "uploads", "elder-signup");
}

export function bindersDir(): string {
  return path.join(DATA_DIR, "uploads", "binders");
}

/** Resolve a stored path (absolute or relative under uploads/). */
export function resolveStoredFilePath(stored: string): string {
  if (path.isAbsolute(stored)) return stored;
  return path.join(uploadsDir(), stored);
}

export async function listVaultBinders(vaultId: string): Promise<VaultBinder[]> {
  const db = await readDb();
  return db.vaultBinders
    .filter((b) => b.vaultId === vaultId)
    .sort((a, b) => b.version - a.version);
}

export async function getVaultBinder(id: string): Promise<VaultBinder | undefined> {
  const db = await readDb();
  return db.vaultBinders.find((b) => b.id === id);
}

export async function getLatestVaultBinder(
  vaultId: string,
): Promise<VaultBinder | null> {
  const list = await listVaultBinders(vaultId);
  return list[0] || null;
}

export async function createVaultBinderGenerating(input: {
  vaultId: string;
  reviewRequestId: string;
  advocateUserId: string | null;
  advocateName: string;
  sealedAt: string;
}): Promise<VaultBinder> {
  const db = await readDb();
  const existing = db.vaultBinders.filter((b) => b.vaultId === input.vaultId);
  const version =
    existing.reduce((max, b) => Math.max(max, b.version), 0) + 1;
  const now = new Date().toISOString();
  const binder: VaultBinder = {
    id: newId(),
    vaultId: input.vaultId,
    reviewRequestId: input.reviewRequestId,
    version,
    status: "generating",
    documentName: `ShambaTrust-Binder-v${version}.pdf`,
    documentPath: null,
    fileHash: null,
    pageCount: null,
    error: null,
    advocateUserId: input.advocateUserId,
    advocateName: input.advocateName,
    sealedAt: input.sealedAt,
    createdAt: now,
    completedAt: null,
  };
  db.vaultBinders.push(binder);
  await writeDb(db);
  return binder;
}

export async function finalizeVaultBinder(
  id: string,
  input: {
    documentPath: string;
    documentName: string;
    fileHash: string;
    pageCount: number;
  },
): Promise<VaultBinder | null> {
  const db = await readDb();
  const binder = db.vaultBinders.find((b) => b.id === id);
  if (!binder) return null;
  binder.status = "ready";
  binder.documentPath = input.documentPath;
  binder.documentName = input.documentName;
  binder.fileHash = input.fileHash;
  binder.pageCount = input.pageCount;
  binder.error = null;
  binder.completedAt = new Date().toISOString();
  await writeDb(db);
  return binder;
}

export async function failVaultBinder(
  id: string,
  error: string,
): Promise<VaultBinder | null> {
  const db = await readDb();
  const binder = db.vaultBinders.find((b) => b.id === id);
  if (!binder) return null;
  binder.status = "failed";
  binder.error = error.slice(0, 500);
  binder.completedAt = new Date().toISOString();
  await writeDb(db);
  return binder;
}

/** Reset a failed binder to generating for retry (same version). */
export async function resetVaultBinderGenerating(
  id: string,
): Promise<VaultBinder | null> {
  const db = await readDb();
  const binder = db.vaultBinders.find((b) => b.id === id);
  if (!binder) return null;
  binder.status = "generating";
  binder.error = null;
  binder.documentPath = null;
  binder.fileHash = null;
  binder.pageCount = null;
  binder.completedAt = null;
  await writeDb(db);
  return binder;
}

export async function recordBillingEvent(input: {
  vaultId: string | null;
  actorUserId: string;
  kind: BillingKind;
  detail: string;
  packageTier?: string | null;
  relatedId?: string | null;
  amountKes?: number;
}): Promise<BillingRecord> {
  const db = await readDb();
  const now = new Date().toISOString();
  const record: BillingRecord = {
    id: newId(),
    vaultId: input.vaultId,
    actorUserId: input.actorUserId,
    kind: input.kind,
    detail: input.detail,
    amountKes:
      input.amountKes ??
      amountForBillingEvent(input.kind, input.packageTier),
    paid: false,
    paidAt: null,
    paidByUserId: null,
    relatedId: input.relatedId ?? null,
    createdAt: now,
  };
  db.billingRecords.push(record);
  await writeDb(db);
  return record;
}

export async function listBillingRecords(): Promise<BillingRecord[]> {
  const db = await readDb();
  return [...db.billingRecords].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function setBillingPaid(
  id: string,
  paid: boolean,
  paidByUserId: string,
): Promise<BillingRecord | null> {
  const db = await readDb();
  const row = db.billingRecords.find((b) => b.id === id);
  if (!row) return null;
  row.paid = paid;
  row.paidAt = paid ? new Date().toISOString() : null;
  row.paidByUserId = paid ? paidByUserId : null;
  await writeDb(db);
  return row;
}

export async function updateVaultOpsControls(input: {
  vaultId: string;
  forceLocked?: boolean;
  opsNotes?: string;
}): Promise<Vault | null> {
  const db = await readDb();
  const vault = db.vaults.find((v) => v.id === input.vaultId);
  if (!vault) return null;
  if (typeof input.forceLocked === "boolean") {
    vault.forceLocked = input.forceLocked;
  }
  if (typeof input.opsNotes === "string") {
    vault.opsNotes = input.opsNotes;
  }
  vault.updatedAt = new Date().toISOString();
  await writeDb(db);
  return vault;
}

export async function updateAdvocateCrm(input: {
  userId: string;
  advocateSuspended?: boolean;
  advocateMaxCases?: number | null;
  advocateOooUntil?: string | null;
  advocateOooNote?: string;
}): Promise<User | null> {
  const db = await readDb();
  const user = db.users.find((u) => u.id === input.userId);
  if (!user || user.role !== "advocate") return null;
  if (typeof input.advocateSuspended === "boolean") {
    user.advocateSuspended = input.advocateSuspended;
  }
  if (input.advocateMaxCases !== undefined) {
    user.advocateMaxCases = input.advocateMaxCases;
  }
  if (input.advocateOooUntil !== undefined) {
    user.advocateOooUntil = input.advocateOooUntil;
  }
  if (typeof input.advocateOooNote === "string") {
    user.advocateOooNote = input.advocateOooNote;
  }
  await writeDb(db);
  return user;
}

export async function createSupportSession(input: {
  adminUserId: string;
  vaultId: string;
  note: string;
  hours?: number;
}): Promise<SupportSession> {
  const db = await readDb();
  const vault = db.vaults.find((v) => v.id === input.vaultId);
  if (!vault) throw new Error("Vault not found.");
  const now = Date.now();
  const session: SupportSession = {
    id: newId(),
    adminUserId: input.adminUserId,
    elderUserId: vault.ownerId,
    vaultId: input.vaultId,
    expiresAt: new Date(now + (input.hours ?? 2) * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(now).toISOString(),
    note: input.note.trim(),
  };
  db.supportSessions.push(session);
  await writeDb(db);
  return session;
}

export async function getSupportSession(
  id: string,
): Promise<SupportSession | undefined> {
  const db = await readDb();
  return db.supportSessions.find((s) => s.id === id);
}

export async function revokeReviewDocAccess(
  reviewId: string,
): Promise<ReviewRequest | null> {
  const db = await readDb();
  const review = db.reviewRequests.find((r) => r.id === reviewId);
  if (!review) return null;
  review.docAccessRevokedAt = new Date().toISOString();
  await writeDb(db);
  return normalizeReview(review);
}

export async function listExpiredDocReviews(
  retentionDays = 90,
): Promise<ReviewRequest[]> {
  const db = await readDb();
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  return db.reviewRequests
    .filter((r) => {
      const revoked = r.docAccessRevokedAt || r.completedAt;
      if (!revoked) return false;
      return new Date(revoked).getTime() < cutoff;
    })
    .map(normalizeReview);
}

export async function purgeExpiredUploadPaths(
  retentionDays = 90,
): Promise<{ purged: number; paths: string[] }> {
  const reviews = await listExpiredDocReviews(retentionDays);
  const db = await readDb();
  const paths: string[] = [];
  for (const review of reviews) {
    const docs = db.legalDocuments.filter((d) => d.reviewRequestId === review.id);
    for (const doc of docs) {
      if (doc.documentPath) {
        try {
          await fs.unlink(doc.documentPath);
          paths.push(doc.documentPath);
          doc.documentPath = null;
        } catch {
          /* missing file ok */
        }
      }
    }
  }
  await writeDb(db);
  return { purged: paths.length, paths };
}

export async function searchEldersVaults(query: string): Promise<
  Array<{
    user: User;
    vault: Vault | null;
  }>
> {
  const q = query.trim().toLowerCase();
  const all = await listEldersNewestFirst();
  if (!q) return all;
  const digits = q.replace(/\D/g, "");
  return all.filter(({ user, vault }) => {
    if (user.fullName.toLowerCase().includes(q)) return true;
    if (user.phone.includes(digits) || user.phone.includes(q)) return true;
    if (vault?.id.toLowerCase().includes(q)) return true;
    if (vault?.status.toLowerCase().includes(q)) return true;
    if (vault?.packageTier?.toLowerCase().includes(q)) return true;
    return false;
  });
}

export async function countAdvocateActiveCases(advocateId: string): Promise<number> {
  const db = await readDb();
  return db.reviewRequests.filter(
    (r) => r.advocateId === advocateId && r.status === "assigned",
  ).length;
}

export async function listAdvocatesCrm(): Promise<
  Array<{
    user: User;
    activeCases: number;
    completedCases: number;
    pendingApps: number;
  }>
> {
  const db = await readDb();
  const advocates = db.users.filter((u) => u.role === "advocate");
  return advocates.map((user) => ({
    user,
    activeCases: db.reviewRequests.filter(
      (r) => r.advocateId === user.id && r.status === "assigned",
    ).length,
    completedCases: db.reviewRequests.filter(
      (r) => r.advocateId === user.id && r.status === "completed",
    ).length,
    pendingApps: db.advocateApplications.filter(
      (a) => a.phone === user.phone && a.status === "pending",
    ).length,
  }));
}

// Phase 7 helpers used early
export async function addCaseMessage(input: Omit<CaseMessage, "id" | "createdAt">): Promise<CaseMessage> {
  const db = await readDb();
  const msg: CaseMessage = {
    id: newId(),
    ...input,
    createdAt: new Date().toISOString(),
  };
  db.caseMessages.push(msg);
  await writeDb(db);
  return msg;
}

export async function listCaseMessages(reviewRequestId: string): Promise<CaseMessage[]> {
  const db = await readDb();
  return db.caseMessages
    .filter((m) => m.reviewRequestId === reviewRequestId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function saveConsultBooking(
  input: Omit<ConsultBooking, "id" | "createdAt" | "status"> & {
    status?: ConsultBooking["status"];
  },
): Promise<ConsultBooking> {
  const db = await readDb();
  const row: ConsultBooking = {
    id: newId(),
    ...input,
    status: input.status || "scheduled",
    createdAt: new Date().toISOString(),
  };
  db.consultBookings.push(row);
  await writeDb(db);
  return row;
}

export async function listConsultBookingsForAdvocate(
  advocateId: string,
): Promise<ConsultBooking[]> {
  const db = await readDb();
  return db.consultBookings
    .filter((c) => c.advocateId === advocateId)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export async function createMarketingLead(
  input: Omit<MarketingLead, "id" | "createdAt">,
): Promise<MarketingLead> {
  const db = await readDb();
  const lead: MarketingLead = {
    id: newId(),
    ...input,
    createdAt: new Date().toISOString(),
  };
  db.marketingLeads.push(lead);
  await writeDb(db);
  return lead;
}

export async function createPublicStatusToken(input: {
  vaultId: string;
  reviewRequestId: string;
}): Promise<PublicStatusToken> {
  const db = await readDb();
  const token: PublicStatusToken = {
    token: newId().replace(/-/g, "").slice(0, 16),
    vaultId: input.vaultId,
    reviewRequestId: input.reviewRequestId,
    createdAt: new Date().toISOString(),
  };
  db.publicStatusTokens.push(token);
  await writeDb(db);
  return token;
}

export async function getPublicStatusToken(
  token: string,
): Promise<PublicStatusToken | undefined> {
  const db = await readDb();
  return db.publicStatusTokens.find((t) => t.token === token);
}
