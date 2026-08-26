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
import {
  DEFAULT_SPOKEN_LANGUAGE,
  normalizeSpokenLanguage,
  type SpokenLanguage,
} from "@/lib/languages";
import type {
  AdvocateMatch,
  AudioTestament,
  ExecutionGuardian,
  SaccoNominee,
  SuccessionApprovalRole,
  TranscriptStatus,
} from "@/lib/db/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "db.json");

const emptyDb = (): Database => ({
  users: [],
  vaults: [],
  assets: [],
  audioTestaments: [],
  advocateMatches: [],
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

/**
 * Older `db.json` files predate the ArdhiSasa / SACCO columns. Fill them in on
 * read so callers never have to guard for `undefined`.
 */
function normalizeAsset(a: Asset): Asset {
  return {
    ...a,
    parcelNumber: a.parcelNumber ?? "",
    blockNumber: a.blockNumber ?? "",
    registrationSection: a.registrationSection ?? "",
    landRegistryOffice: a.landRegistryOffice ?? "",
    saccoName: a.saccoName ?? "",
    saccoMemberNumber: a.saccoMemberNumber ?? "",
    saccoNominees: Array.isArray(a.saccoNominees) ? a.saccoNominees : [],
    mpesaNumber: a.mpesaNumber ?? "",
  };
}

function normalizeLegalDoc(d: LegalDocument): LegalDocument {
  return {
    ...d,
    stampRef: d.stampRef ?? null,
    stampedAt: d.stampedAt ?? null,
    stampedByUserId: d.stampedByUserId ?? null,
    stampAdvocateName: d.stampAdvocateName ?? "",
    stampLskNumber: d.stampLskNumber ?? "",
    stampCounty: d.stampCounty ?? "",
    stampNotes: d.stampNotes ?? "",
  };
}

function normalizePlan(p: ExecutionPlan): ExecutionPlan {
  const guardians = Array.isArray(p.guardians) ? p.guardians : [];
  return {
    ...p,
    trustees: Array.isArray(p.trustees) ? p.trustees : [],
    guardians,
    // Legacy plans have no guardians; keep the requirement at 0 so their
    // existing claims still reach ops instead of stalling forever.
    minGuardianApprovals:
      typeof p.minGuardianApprovals === "number"
        ? p.minGuardianApprovals
        : Math.min(2, guardians.length),
    requireDeathNotification: Boolean(p.requireDeathNotification),
  };
}

function normalizeSuccessionCase(c: SuccessionCase): SuccessionCase {
  return {
    ...c,
    deathNotificationName: c.deathNotificationName ?? null,
    deathNotificationPath: c.deathNotificationPath ?? null,
    vaultReleasedAt: c.vaultReleasedAt ?? null,
    vaultReleasedByUserId: c.vaultReleasedByUserId ?? null,
    releaseNotes: c.releaseNotes ?? "",
  };
}

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
    preferredLanguage: normalizeSpokenLanguage(u.preferredLanguage ?? u.locale),
    audioGuidance: Boolean(u.audioGuidance),
    advocateLicense: u.advocateLicense ?? null,
    opsSeat:
      u.opsSeat ??
      (u.role === "admin" ? getOpsSeatRole(u.phone) : null),
    advocateCounties: Array.isArray(u.advocateCounties)
      ? u.advocateCounties
      : [],
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
  db.assets = (db.assets || []).map(normalizeAsset);
  db.legalDocuments = (db.legalDocuments || []).map(normalizeLegalDoc);
  db.executionPlans = (db.executionPlans || []).map(normalizePlan);
  db.successionCases = (db.successionCases || []).map(normalizeSuccessionCase);
  db.successionApprovals = (db.successionApprovals || []).map((a) => ({
    ...a,
    role: a.role ?? "trustee",
  }));
  db.audioTestaments = (db.audioTestaments || []).map((t) => ({
    ...t,
    language: normalizeSpokenLanguage(t.language),
    transcript: t.transcript ?? "",
    transcriptNotes: t.transcriptNotes ?? "",
  }));
  db.advocateMatches = db.advocateMatches || [];
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
  preferredLanguage?: SpokenLanguage;
  audioGuidance?: boolean;
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
    preferredLanguage: normalizeSpokenLanguage(
      input.preferredLanguage ?? input.locale ?? DEFAULT_SPOKEN_LANGUAGE,
    ),
    audioGuidance: Boolean(input.audioGuidance),
    idFrontName: input.idFrontName ?? null,
    idFrontPath: input.idFrontPath ?? null,
    idBackName: input.idBackName ?? null,
    idBackPath: input.idBackPath ?? null,
    address: input.address?.trim() || "",
    county: input.county?.trim() || "",
    profileComplete: input.profileComplete !== false,
    advocateLicense: input.advocateLicense || null,
    opsSeat: input.role === "admin" ? getOpsSeatRole(input.phone) : null,
    advocateCounties:
      input.role === "advocate" && input.county?.trim()
        ? [input.county.trim()]
        : [],
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

/** Stamp ids onto nominee rows so React keys and edits stay stable. */
function withNomineeIds(
  nominees: Array<Omit<SaccoNominee, "id"> & { id?: string }> | undefined,
): SaccoNominee[] {
  if (!nominees) return [];
  return nominees.map((nominee) => ({
    id: nominee.id || newId(),
    fullName: nominee.fullName.trim(),
    idNumber: nominee.idNumber.trim(),
    phone: nominee.phone.trim(),
    relationship: nominee.relationship.trim(),
    percentage: nominee.percentage,
  }));
}

export async function saveAsset(
  asset: Omit<Asset, "id" | "createdAt" | "updatedAt" | "saccoNominees"> & {
    id?: string;
    saccoNominees?: Array<Omit<SaccoNominee, "id"> & { id?: string }>;
  },
): Promise<Asset> {
  const db = await readDb();
  const now = new Date().toISOString();
  const saccoNominees = withNomineeIds(asset.saccoNominees);
  if (asset.id) {
    const idx = db.assets.findIndex((a) => a.id === asset.id);
    if (idx >= 0) {
      const updated: Asset = {
        ...db.assets[idx],
        ...asset,
        saccoNominees,
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
    parcelNumber: asset.parcelNumber || "",
    blockNumber: asset.blockNumber || "",
    registrationSection: asset.registrationSection || "",
    landRegistryOffice: asset.landRegistryOffice || "",
    registrationNumber: asset.registrationNumber || "",
    makeModel: asset.makeModel || "",
    year: asset.year || "",
    bankName: asset.bankName || "",
    accountNumber: asset.accountNumber || "",
    accountType: asset.accountType || "",
    businessRegNumber: asset.businessRegNumber || "",
    kraPin: asset.kraPin || "",
    saccoName: asset.saccoName || "",
    saccoMemberNumber: asset.saccoMemberNumber || "",
    saccoNominees,
    mpesaNumber: asset.mpesaNumber || "",
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
  // Keep the recording; it is evidence of intent. Just drop the dangling link.
  for (const testament of db.audioTestaments) {
    if (testament.assetId === assetId) testament.assetId = null;
  }
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

/** Human-readable, collision-resistant reference printed on the stamp. */
function buildStampRef(lskNumber: string): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const suffix = newId().replace(/-/g, "").slice(0, 6).toUpperCase();
  const licence = normalizeLskNumber(lskNumber) || "LSK";
  return `ST-${licence}-${stamp}-${suffix}`;
}

export async function stampLegalDocument(input: {
  documentId: string;
  advocateUserId: string;
  advocateName: string;
  lskNumber: string;
  county: string;
  notes: string;
}): Promise<LegalDocument | null> {
  const db = await readDb();
  const doc = db.legalDocuments.find((d) => d.id === input.documentId);
  if (!doc) return null;

  const now = new Date().toISOString();
  // Re-stamping keeps the original reference so the chain of custody is stable.
  doc.stampRef = doc.stampRef || buildStampRef(input.lskNumber);
  doc.stampedAt = now;
  doc.stampedByUserId = input.advocateUserId;
  doc.stampAdvocateName = input.advocateName;
  doc.stampLskNumber = normalizeLskNumber(input.lskNumber);
  doc.stampCounty = input.county.trim();
  doc.stampNotes = input.notes.trim();
  if (doc.status === "draft") doc.status = "ready_for_sign";
  doc.updatedAt = now;

  await writeDb(db);
  return doc;
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
    stampRef: null,
    stampedAt: null,
    stampedByUserId: null,
    stampAdvocateName: "",
    stampLskNumber: "",
    stampCounty: "",
    stampNotes: "",
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
    preferredLanguage: DEFAULT_SPOKEN_LANGUAGE,
    audioGuidance: false,
    idFrontName: null,
    idFrontPath: null,
    idBackName: null,
    idBackPath: null,
    address: "",
    county: "",
    profileComplete: true,
    advocateLicense: null,
    opsSeat: getOpsSeatRole(input.phone) || "super",
    advocateCounties: [],
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
    guardians: [],
    minGuardianApprovals: 2,
    requireDeathCertificate: true,
    requireDeathNotification: true,
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
  guardians: ExecutionGuardian[];
  minGuardianApprovals: number;
  requireDeathCertificate: boolean;
  requireDeathNotification: boolean;
  coolingHours: number;
  updatedByUserId: string;
}): Promise<ExecutionPlan> {
  const db = await readDb();
  const now = new Date().toISOString();
  const existing = db.executionPlans.find((p) => p.vaultId === input.vaultId);
  if (existing) {
    existing.trustees = input.trustees;
    existing.minTrusteeApprovals = input.minTrusteeApprovals;
    existing.guardians = input.guardians;
    existing.minGuardianApprovals = input.minGuardianApprovals;
    existing.requireDeathCertificate = input.requireDeathCertificate;
    existing.requireDeathNotification = input.requireDeathNotification;
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
    guardians: input.guardians,
    minGuardianApprovals: input.minGuardianApprovals,
    requireDeathCertificate: input.requireDeathCertificate,
    requireDeathNotification: input.requireDeathNotification,
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

/**
 * Which confirmation stage a claim is sitting in, given how many trustee and
 * guardian approvals have landed so far. Trustees go first, guardians second,
 * and only then does the case reach the ops desk.
 */
function successionStageFor(input: {
  trusteeApproved: number;
  trusteeRequired: number;
  guardianApproved: number;
  guardianRequired: number;
}): Extract<
  SuccessionCaseStatus,
  | "awaiting_trustee_otps"
  | "awaiting_guardian_confirmations"
  | "pending_ops_verification"
> {
  if (input.trusteeApproved < input.trusteeRequired) {
    return "awaiting_trustee_otps";
  }
  if (input.guardianApproved < input.guardianRequired) {
    return "awaiting_guardian_confirmations";
  }
  return "pending_ops_verification";
}

/** Approval thresholds for a case, clamped to the people actually named. */
function successionThresholds(
  db: Database,
  vaultId: string,
  caseId: string,
): { trusteeRequired: number; guardianRequired: number } {
  const plan = db.executionPlans.find((p) => p.vaultId === vaultId);
  const slots = db.successionApprovals.filter((a) => a.caseId === caseId);
  const trusteeSlots = slots.filter((a) => a.role === "trustee").length;
  const guardianSlots = slots.filter((a) => a.role === "guardian").length;
  return {
    trusteeRequired: Math.min(plan?.minTrusteeApprovals ?? 1, trusteeSlots),
    guardianRequired: Math.min(plan?.minGuardianApprovals ?? 0, guardianSlots),
  };
}

export async function createSuccessionCase(input: {
  vaultId: string;
  filedByUserId: string;
  deathDate: string;
  deathCertificateName: string | null;
  deathCertificatePath: string | null;
  deathNotificationName: string | null;
  deathNotificationPath: string | null;
  filerNotes: string;
  trustees: ExecutionTrustee[];
  guardians: ExecutionGuardian[];
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
  const created: SuccessionCase = {
    id: newId(),
    vaultId: input.vaultId,
    filedByUserId: input.filedByUserId,
    status: "succession_filed",
    deathDate: input.deathDate,
    deathCertificateName: input.deathCertificateName,
    deathCertificatePath: input.deathCertificatePath,
    deathNotificationName: input.deathNotificationName,
    deathNotificationPath: input.deathNotificationPath,
    filerNotes: input.filerNotes,
    opsReviewedByUserId: null,
    opsDecisionAt: null,
    opsNotes: "",
    advocateId: null,
    coolingEndsAt: null,
    vaultReleasedAt: null,
    vaultReleasedByUserId: null,
    releaseNotes: "",
    createdAt: now,
    updatedAt: now,
  };
  db.successionCases.push(created);

  const approvals: SuccessionApproval[] = [
    ...input.trustees.map((t) => ({
      id: newId(),
      caseId: created.id,
      role: "trustee" as const,
      trusteePhone: t.phone,
      trusteeName: t.fullName,
      status: "pending" as const,
      approvedAt: null,
      userId: null,
    })),
    ...input.guardians.map((g) => ({
      id: newId(),
      caseId: created.id,
      role: "guardian" as const,
      trusteePhone: g.phone,
      trusteeName: g.fullName,
      status: "pending" as const,
      approvedAt: null,
      userId: null,
    })),
  ];
  db.successionApprovals.push(...approvals);

  const { trusteeRequired, guardianRequired } = successionThresholds(
    db,
    input.vaultId,
    created.id,
  );
  created.status = successionStageFor({
    trusteeApproved: 0,
    trusteeRequired,
    guardianApproved: 0,
    guardianRequired,
  });

  await writeDb(db);
  return { case: created, approvals };
}

export type SuccessionApprovalProgress = {
  approval: SuccessionApproval;
  successionCase: SuccessionCase;
  role: SuccessionApprovalRole;
  trusteeApproved: number;
  trusteeRequired: number;
  guardianApproved: number;
  guardianRequired: number;
};

/**
 * Which pending approval slot a given phone can act on right now. Someone named
 * as both trustee and guardian confirms twice — once per stage — so the slot is
 * chosen from the stage the case is currently in.
 */
export function pendingApprovalRoleFor(
  approvals: SuccessionApproval[],
  status: SuccessionCaseStatus,
  phone: string,
): SuccessionApprovalRole | null {
  const stageRole: SuccessionApprovalRole =
    status === "awaiting_guardian_confirmations" ? "guardian" : "trustee";
  const pending = approvals.filter(
    (a) => a.status === "pending" && phonesEqual(a.trusteePhone, phone),
  );
  if (pending.some((a) => a.role === stageRole)) return stageRole;
  return null;
}

export async function approveSuccessionApproval(input: {
  caseId: string;
  phone: string;
  userId: string;
}): Promise<SuccessionApprovalProgress> {
  const db = await readDb();
  const successionCase = db.successionCases.find((c) => c.id === input.caseId);
  if (!successionCase) throw new Error("Succession case not found.");

  if (
    successionCase.status !== "awaiting_trustee_otps" &&
    successionCase.status !== "awaiting_guardian_confirmations" &&
    successionCase.status !== "succession_filed"
  ) {
    throw new Error("This claim is not waiting for confirmations.");
  }

  const caseApprovals = db.successionApprovals.filter(
    (a) => a.caseId === input.caseId,
  );
  const role = pendingApprovalRoleFor(
    caseApprovals,
    successionCase.status,
    input.phone,
  );
  if (!role) {
    throw new Error(
      successionCase.status === "awaiting_guardian_confirmations"
        ? "This claim is waiting on guardian confirmations, and no guardian slot is open for your number."
        : "No pending trustee approval for your number on this claim.",
    );
  }

  const approval = caseApprovals.find(
    (a) =>
      a.role === role &&
      a.status === "pending" &&
      phonesEqual(a.trusteePhone, input.phone),
  );
  if (!approval) throw new Error("No pending approval for your number.");

  // The dual-guardian rule only means something if two different people sign.
  const alreadySignedSameStage = caseApprovals.some(
    (a) =>
      a.role === role && a.status === "approved" && a.userId === input.userId,
  );
  if (alreadySignedSameStage) {
    throw new Error(
      `You have already confirmed as a ${role} on this claim. A different ${role} must confirm.`,
    );
  }

  const now = new Date().toISOString();
  approval.status = "approved";
  approval.approvedAt = now;
  approval.userId = input.userId;

  const { trusteeRequired, guardianRequired } = successionThresholds(
    db,
    successionCase.vaultId,
    input.caseId,
  );
  const trusteeApproved = caseApprovals.filter(
    (a) => a.role === "trustee" && a.status === "approved",
  ).length;
  const guardianApproved = caseApprovals.filter(
    (a) => a.role === "guardian" && a.status === "approved",
  ).length;

  successionCase.status = successionStageFor({
    trusteeApproved,
    trusteeRequired,
    guardianApproved,
    guardianRequired,
  });
  successionCase.updatedAt = now;

  await writeDb(db);
  return {
    approval,
    successionCase,
    role,
    trusteeApproved,
    trusteeRequired,
    guardianApproved,
    guardianRequired,
  };
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

/**
 * Final gate of the Dead Man's Switch: ops hand the sealed vault to the
 * executors. Only reachable after ops verification, after the cooling period,
 * and only when every proof the elder demanded is actually on file.
 */
export async function releaseSuccessionVault(input: {
  caseId: string;
  adminUserId: string;
  releaseNotes: string;
}): Promise<SuccessionCase> {
  const db = await readDb();
  const successionCase = db.successionCases.find((c) => c.id === input.caseId);
  if (!successionCase) throw new Error("Succession case not found.");
  if (successionCase.vaultReleasedAt) return successionCase;

  if (
    successionCase.status !== "succession_verified" &&
    successionCase.status !== "with_advocate" &&
    successionCase.status !== "succession_completed"
  ) {
    throw new Error(
      "Vault access can only be released after ops verify the claim.",
    );
  }

  if (
    successionCase.coolingEndsAt &&
    new Date(successionCase.coolingEndsAt).getTime() > Date.now()
  ) {
    throw new Error(
      `Cooling period is still active until ${new Date(successionCase.coolingEndsAt).toLocaleString()}.`,
    );
  }

  const plan = db.executionPlans.find(
    (p) => p.vaultId === successionCase.vaultId,
  );
  if (plan?.requireDeathCertificate && !successionCase.deathCertificatePath) {
    throw new Error("Death certificate is missing on this claim.");
  }
  if (plan?.requireDeathNotification && !successionCase.deathNotificationPath) {
    throw new Error("Official death notification is missing on this claim.");
  }

  const { trusteeRequired, guardianRequired } = successionThresholds(
    db,
    successionCase.vaultId,
    input.caseId,
  );
  const caseApprovals = db.successionApprovals.filter(
    (a) => a.caseId === input.caseId,
  );
  const trusteeApproved = caseApprovals.filter(
    (a) => a.role === "trustee" && a.status === "approved",
  ).length;
  const guardianApproved = caseApprovals.filter(
    (a) => a.role === "guardian" && a.status === "approved",
  ).length;
  if (trusteeApproved < trusteeRequired) {
    throw new Error(
      `Trustee approvals incomplete (${trusteeApproved}/${trusteeRequired}).`,
    );
  }
  if (guardianApproved < guardianRequired) {
    throw new Error(
      `Guardian confirmations incomplete (${guardianApproved}/${guardianRequired}).`,
    );
  }

  const now = new Date().toISOString();
  successionCase.vaultReleasedAt = now;
  successionCase.vaultReleasedByUserId = input.adminUserId;
  successionCase.releaseNotes = input.releaseNotes.trim();
  successionCase.updatedAt = now;

  await writeDb(db);
  return successionCase;
}

/**
 * Executors who may open a released vault: the trustees and guardians who
 * actually confirmed, plus the named heirs. The person who filed only qualifies
 * through one of those roles.
 */
export async function userCanOpenReleasedVault(input: {
  userId: string;
  phone: string;
  caseId: string;
}): Promise<boolean> {
  const db = await readDb();
  const successionCase = db.successionCases.find((c) => c.id === input.caseId);
  if (!successionCase?.vaultReleasedAt) return false;

  const confirmed = db.successionApprovals.some(
    (a) =>
      a.caseId === input.caseId &&
      a.status === "approved" &&
      (a.userId === input.userId || phonesEqual(a.trusteePhone, input.phone)),
  );
  if (confirmed) return true;

  return db.beneficiaries.some(
    (b) =>
      b.vaultId === successionCase.vaultId &&
      Boolean(b.phone) &&
      phonesEqual(b.phone, input.phone),
  );
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
        preferredLanguage: DEFAULT_SPOKEN_LANGUAGE,
        audioGuidance: false,
        idFrontName: app.idFrontName || null,
        idFrontPath: app.idFrontPath || null,
        idBackName: app.idBackName || null,
        idBackPath: app.idBackPath || null,
        address: app.officeAddress || "",
        county: "",
        profileComplete: true,
        advocateLicense: app.lskNumber,
        opsSeat: null,
        advocateCounties: [],
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

export async function listAudioTestaments(
  vaultId: string,
): Promise<AudioTestament[]> {
  const db = await readDb();
  return db.audioTestaments
    .filter((t) => t.vaultId === vaultId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAudioTestament(
  id: string,
): Promise<AudioTestament | undefined> {
  const db = await readDb();
  return db.audioTestaments.find((t) => t.id === id);
}

export async function createAudioTestament(input: {
  vaultId: string;
  assetId: string | null;
  recordedByUserId: string;
  recordedByAgent: boolean;
  title: string;
  language: SpokenLanguage;
  documentName: string;
  documentPath: string;
  mimeType: string;
  fileSize: number;
  durationSeconds: number | null;
}): Promise<AudioTestament> {
  const db = await readDb();
  const now = new Date().toISOString();
  const created: AudioTestament = {
    id: newId(),
    vaultId: input.vaultId,
    assetId: input.assetId,
    recordedByUserId: input.recordedByUserId,
    recordedByAgent: input.recordedByAgent,
    title: input.title.trim() || "Voice testament",
    language: normalizeSpokenLanguage(input.language),
    documentName: input.documentName,
    documentPath: input.documentPath,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    durationSeconds: input.durationSeconds,
    transcript: "",
    transcriptStatus: "pending",
    transcribedByUserId: null,
    transcribedAt: null,
    transcriptNotes: "",
    createdAt: now,
    updatedAt: now,
  };
  db.audioTestaments.push(created);
  await touchVault(db, input.vaultId);
  await writeDb(db);
  return created;
}

export async function saveAudioTranscript(input: {
  testamentId: string;
  transcript: string;
  transcriptStatus: TranscriptStatus;
  transcriptNotes: string;
  transcribedByUserId: string;
}): Promise<AudioTestament | null> {
  const db = await readDb();
  const testament = db.audioTestaments.find((t) => t.id === input.testamentId);
  if (!testament) return null;

  const now = new Date().toISOString();
  testament.transcript = input.transcript;
  testament.transcriptStatus = input.transcriptStatus;
  testament.transcriptNotes = input.transcriptNotes.trim();
  testament.transcribedByUserId = input.transcribedByUserId;
  testament.transcribedAt =
    input.transcriptStatus === "pending" ? null : now;
  testament.updatedAt = now;

  await writeDb(db);
  return testament;
}

export async function deleteAudioTestament(
  vaultId: string,
  testamentId: string,
): Promise<AudioTestament | null> {
  const db = await readDb();
  const testament = db.audioTestaments.find(
    (t) => t.id === testamentId && t.vaultId === vaultId,
  );
  if (!testament) return null;
  db.audioTestaments = db.audioTestaments.filter((t) => t.id !== testamentId);
  await touchVault(db, vaultId);
  await writeDb(db);
  return testament;
}

export async function listAllPendingTranscripts(): Promise<AudioTestament[]> {
  const db = await readDb();
  return db.audioTestaments
    .filter(
      (t) =>
        t.transcriptStatus === "pending" || t.transcriptStatus === "in_progress",
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function replaceAdvocateMatches(
  reviewRequestId: string,
  matches: Array<Omit<AdvocateMatch, "id" | "createdAt" | "resolvedAt" | "status">>,
): Promise<AdvocateMatch[]> {
  const db = await readDb();
  db.advocateMatches = db.advocateMatches.filter(
    (m) => m.reviewRequestId !== reviewRequestId,
  );
  const now = new Date().toISOString();
  const created: AdvocateMatch[] = matches.map((m) => ({
    id: newId(),
    ...m,
    status: "offered",
    createdAt: now,
    resolvedAt: null,
  }));
  db.advocateMatches.push(...created);
  await writeDb(db);
  return created;
}

export async function listAdvocateMatchesForReview(
  reviewRequestId: string,
): Promise<AdvocateMatch[]> {
  const db = await readDb();
  return db.advocateMatches
    .filter((m) => m.reviewRequestId === reviewRequestId)
    .sort((a, b) => b.score - a.score);
}

export async function listAdvocateMatchesForAdvocate(
  advocateId: string,
): Promise<AdvocateMatch[]> {
  const db = await readDb();
  return db.advocateMatches
    .filter((m) => m.advocateId === advocateId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** First advocate to claim wins; the remaining offers on that case expire. */
export async function resolveAdvocateMatches(
  reviewRequestId: string,
  claimedByAdvocateId: string,
): Promise<void> {
  const db = await readDb();
  const now = new Date().toISOString();
  let changed = false;
  for (const match of db.advocateMatches) {
    if (match.reviewRequestId !== reviewRequestId) continue;
    if (match.status !== "offered") continue;
    match.status =
      match.advocateId === claimedByAdvocateId ? "claimed" : "expired";
    match.resolvedAt = now;
    changed = true;
  }
  if (changed) await writeDb(db);
}

export async function updateUserPreferences(input: {
  userId: string;
  locale?: User["locale"];
  preferredLanguage?: SpokenLanguage;
  audioGuidance?: boolean;
}): Promise<User | null> {
  const db = await readDb();
  const user = db.users.find((u) => u.id === input.userId);
  if (!user) return null;
  if (input.locale) user.locale = input.locale;
  if (input.preferredLanguage) {
    user.preferredLanguage = normalizeSpokenLanguage(input.preferredLanguage);
  }
  if (typeof input.audioGuidance === "boolean") {
    user.audioGuidance = input.audioGuidance;
  }
  await writeDb(db);
  return user;
}

export async function updateAdvocateCounties(
  userId: string,
  counties: string[],
): Promise<User | null> {
  const db = await readDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user || user.role !== "advocate") return null;
  user.advocateCounties = counties;
  await writeDb(db);
  return user;
}

export async function listActiveAdvocates(): Promise<User[]> {
  const db = await readDb();
  return db.users.filter((u) => u.role === "advocate" && !u.advocateSuspended);
}

export function uploadsDir(): string {
  return path.join(DATA_DIR, "uploads");
}

export function testamentUploadsDir(): string {
  return path.join(DATA_DIR, "uploads", "testaments");
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
