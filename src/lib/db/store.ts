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
  User,
  Vault,
  VaultBinder,
  VaultSetupStep,
  VaultStatus,
  WillDraft,
  TrustDraft,
  BurialWishes,
  DsarRequest,
  DsarStatus,
  OutboundNotice,
  CheckoutCurrency,
  CheckoutKind,
  CheckoutProvider,
  ConsensusProposal,
  ConsensusProposalKind,
  ConsensusSignerRole,
  BuyoutOffer,
  HouseholdHouse,
  PaymentCheckout,
  ExecutionEnforcer,
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
import { getWorkerEnv } from "@/lib/cf-env";
import { blobKey, deleteStoredFile, uploadsDir } from "@/lib/db/blobs";
import {
  isMinorDob,
  mergeTestamentaryTrustTerms,
} from "@/lib/inheritance/minors";
import { toKesEquivalent } from "@/lib/payments/fx";
import {
  inferArdhiSasaStatus,
  pendingSearchResult,
} from "@/lib/land-registry/verification";
import { attemptCheckoutGateway } from "@/lib/payments/gateways";

export {
  advocateUploadsDir,
  bindersDir,
  blobKey,
  deleteStoredFile,
  elderSignupUploadsDir,
  isUnsafeBlobKey,
  readStoredFile,
  testamentUploadsDir,
  uploadsDir,
  writeStoredFile,
} from "@/lib/db/blobs";

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
  paymentCheckouts: [],
  supportSessions: [],
  caseMessages: [],
  consultBookings: [],
  marketingLeads: [],
  publicStatusTokens: [],
  vaultBinders: [],
  householdHouses: [],
  consensusProposals: [],
  buyoutOffers: [],
  otps: [],
  auditLog: [],
  dsarRequests: [],
  outboundNotices: [],
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
    disputeFlag: Boolean(a.disputeFlag),
    disputeNotes: a.disputeNotes ?? "",
    familyAlert: Boolean(a.familyAlert),
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
    enforcer: p.enforcer ?? null,
    minCoSignApprovals:
      typeof p.minCoSignApprovals === "number" ? p.minCoSignApprovals : 2,
    requireDeathNotification: Boolean(p.requireDeathNotification),
  };
}

function normalizeWillDraft(d: WillDraft | null | undefined): WillDraft | null {
  if (!d) return null;
  return {
    ...d,
    testamentaryTrustEnabled: Boolean(d.testamentaryTrustEnabled),
    testamentaryTrustTerms: d.testamentaryTrustTerms ?? "",
    testamentaryTrustUntilAge: d.testamentaryTrustUntilAge ?? 18,
  };
}

function normalizeTrustDraft(d: TrustDraft | null | undefined): TrustDraft | null {
  if (!d) return null;
  return {
    ...d,
    enforcerName: d.enforcerName ?? "",
    enforcerPhone: d.enforcerPhone ?? "",
    enforcerIdNumber: d.enforcerIdNumber ?? "",
    enforcerOrganization: d.enforcerOrganization ?? "",
    minCoSignApprovals:
      typeof d.minCoSignApprovals === "number" ? d.minCoSignApprovals : 2,
  };
}

function normalizeBurialWishes(
  d: BurialWishes | null | undefined,
): BurialWishes | null {
  if (!d) return null;
  return {
    ...d,
    burialPlotTitle: d.burialPlotTitle ?? "",
    burialGpsLat: d.burialGpsLat ?? null,
    burialGpsLng: d.burialGpsLng ?? null,
    clanEldersToInvolve: d.clanEldersToInvolve ?? "",
    culturalTraditions: d.culturalTraditions ?? "",
    saccoNomineeName: d.saccoNomineeName ?? "",
    saccoNomineePhone: d.saccoNomineePhone ?? "",
    saccoAccount: d.saccoAccount ?? "",
    mpesaNomineePhone: d.mpesaNomineePhone ?? "",
    insurancePolicyRef: d.insurancePolicyRef ?? "",
    liquidityNotes: d.liquidityNotes ?? "",
  };
}

function blankDiasporaFields() {
  return {
    diasporaNationalId: "",
    ecitizenId: "",
    ardhiSasaId: "",
    passportNumber: "",
    passportCountry: "",
    countryOfResidence: "",
    isDiaspora: false,
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

function normalizeDb(parsed: Partial<Database>): Database {
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
    diasporaNationalId: u.diasporaNationalId ?? "",
    ecitizenId: u.ecitizenId ?? "",
    ardhiSasaId: u.ardhiSasaId ?? "",
    passportNumber: u.passportNumber ?? "",
    passportCountry: u.passportCountry ?? "",
    countryOfResidence: u.countryOfResidence ?? "",
    isDiaspora: Boolean(u.isDiaspora),
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
    willDraft: normalizeWillDraft(v.willDraft),
    trustDraft: normalizeTrustDraft(v.trustDraft),
    burialWishes: normalizeBurialWishes(v.burialWishes),
  }));
  db.titleLookups = (db.titleLookups || []).map((t) => ({
    ...t,
    reviewRequestId: t.reviewRequestId ?? null,
    costKes: t.costKes ?? amountForBillingEvent("title_lookup"),
    ardhiSasaId: t.ardhiSasaId ?? "",
    ecitizenId: t.ecitizenId ?? "",
    parcelNumber: t.parcelNumber ?? "",
    blockNumber: t.blockNumber ?? "",
    registrationSection: t.registrationSection ?? "",
    landRegistryOffice: t.landRegistryOffice ?? "",
    advocateNotes: t.advocateNotes ?? "",
    consentPath: t.consentPath === "family_assisted" ? "family_assisted" : "paper_authorization",
    consentHelperBeneficiaryId: t.consentHelperBeneficiaryId ?? null,
    consentHelperName: t.consentHelperName ?? "",
    consentHelperPhone: t.consentHelperPhone ?? "",
    authorizationName: t.authorizationName ?? null,
    authorizationPath: t.authorizationPath ?? null,
    authorizationSignedAt: t.authorizationSignedAt ?? null,
    familyAlertSentAt: t.familyAlertSentAt ?? null,
    documentName: t.documentName ?? null,
    documentPath: t.documentPath ?? null,
    filedAt: t.filedAt ?? null,
    certificateUploadedAt: t.certificateUploadedAt ?? null,
    updatedAt: t.updatedAt ?? t.createdAt,
    result: t.result
      ? { ...t.result, simulated: Boolean(t.result.simulated) }
      : pendingSearchResult(),
    status: inferArdhiSasaStatus(t),
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
  db.billingRecords = (db.billingRecords || []).map((b) => ({
    ...b,
    currency: b.currency || "KES",
    provider: b.provider || "till",
  }));
  db.paymentCheckouts = db.paymentCheckouts || [];
  db.supportSessions = db.supportSessions || [];
  db.caseMessages = db.caseMessages || [];
  db.consultBookings = (db.consultBookings || []).map((c) => ({
    ...c,
    reviewRequestId: c.reviewRequestId || null,
    kind: c.kind || "consult",
    diasporaSignerName: c.diasporaSignerName ?? "",
    diasporaSignerPhone: c.diasporaSignerPhone ?? "",
    meetingUrl: c.meetingUrl ?? "",
  }));
  db.marketingLeads = db.marketingLeads || [];
  db.publicStatusTokens = db.publicStatusTokens || [];
  db.vaultBinders = db.vaultBinders || [];
  db.householdHouses = db.householdHouses || [];
  db.consensusProposals = (db.consensusProposals || []).map((p) => ({
    ...p,
    signatures: Array.isArray(p.signatures) ? p.signatures : [],
  }));
  db.buyoutOffers = (db.buyoutOffers || []).map((o) => ({
    ...o,
    responses: Array.isArray(o.responses) ? o.responses : [],
  }));
  db.dsarRequests = db.dsarRequests || [];
  db.outboundNotices = db.outboundNotices || [];
  db.beneficiaries = (db.beneficiaries || []).map((b) => ({
    ...b,
    dateOfBirth: b.dateOfBirth ?? "",
    houseId: b.houseId ?? null,
    isMinor: Boolean(b.isMinor) || isMinorDob(b.dateOfBirth ?? ""),
  }));
  return db;
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
  const env = await getWorkerEnv();
  if (env.DB) {
    const row = await env.DB.prepare(
      "SELECT payload FROM app_state WHERE id = 1",
    ).first<{ payload: string }>();
    if (!row?.payload) {
      return normalizeDb(emptyDb());
    }
    return normalizeDb(JSON.parse(row.payload) as Partial<Database>);
  }
  await ensureDb();
  const raw = await fs.readFile(DB_PATH, "utf8");
  return normalizeDb(JSON.parse(raw) as Partial<Database>);
}

export async function writeDb(db: Database): Promise<void> {
  const env = await getWorkerEnv();
  if (env.DB) {
    const row = await env.DB.prepare(
      "SELECT payload FROM app_state WHERE id = 1",
    ).first<{ payload: string }>();
    if (row?.payload) {
      try {
        const existing = JSON.parse(row.payload) as Partial<Database>;
        if ((existing.users?.length || 0) > 0 && (db.users?.length || 0) === 0) {
          throw new Error(
            "Refusing to overwrite the live vault with an empty user list.",
          );
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("Refusing to overwrite")
        ) {
          throw error;
        }
      }
    }
    await env.DB.prepare(
      `INSERT INTO app_state (id, payload, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    )
      .bind(JSON.stringify(db), new Date().toISOString())
      .run();
    return;
  }
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
    ...blankDiasporaFields(),
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
      willDraft: null,
      trustDraft: null,
      burialWishes: null,
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
    disputeFlag: Boolean(asset.disputeFlag),
    disputeNotes: asset.disputeNotes || "",
    familyAlert: Boolean(asset.familyAlert),
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

function applyMinorProtectionInDb(db: Database, vaultId: string): void {
  const vault = db.vaults.find((v) => v.id === vaultId);
  if (!vault) return;
  const heirs = db.beneficiaries.filter((b) => b.vaultId === vaultId);
  const now = new Date();
  for (const heir of heirs) {
    heir.isMinor = isMinorDob(heir.dateOfBirth || "", now);
  }
  const minors = heirs.filter((h) => h.isMinor);
  if (minors.length === 0) return;
  const terms = mergeTestamentaryTrustTerms(
    vault.willDraft?.testamentaryTrustTerms || "",
    minors,
  );
  const stamp = new Date().toISOString();
  if (!vault.willDraft) {
    vault.willDraft = {
      testatorName: "",
      testatorId: "",
      primaryResidence: "",
      executorName: "",
      executorPhone: "",
      altExecutorName: "",
      altExecutorPhone: "",
      guardianName: "",
      guardianPhone: "",
      altGuardianName: "",
      witnessAcknowledged: false,
      notes: "",
      testamentaryTrustEnabled: true,
      testamentaryTrustTerms: terms,
      testamentaryTrustUntilAge: 18,
      updatedAt: stamp,
    };
  } else {
    vault.willDraft.testamentaryTrustEnabled = true;
    vault.willDraft.testamentaryTrustUntilAge =
      vault.willDraft.testamentaryTrustUntilAge || 18;
    vault.willDraft.testamentaryTrustTerms = terms;
    vault.willDraft.updatedAt = stamp;
  }
  vault.updatedAt = stamp;
}

export async function saveBeneficiary(
  input: Omit<Beneficiary, "id" | "createdAt" | "isMinor"> & { id?: string },
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
    dateOfBirth: input.dateOfBirth || "",
    houseId: input.houseId ?? null,
    isMinor: isMinorDob(input.dateOfBirth || ""),
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
      applyMinorProtectionInDb(db, input.vaultId);
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
  applyMinorProtectionInDb(db, input.vaultId);
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
  applyMinorProtectionInDb(db, vaultId);
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
  requestedByUserId: string;
  reviewRequestId?: string | null;
  costKes?: number;
  ardhiSasaId?: string;
  ecitizenId?: string;
  parcelNumber?: string;
  blockNumber?: string;
  registrationSection?: string;
  landRegistryOffice?: string;
  advocateNotes?: string;
  consentPath?: TitleLookupRecord["consentPath"];
  consentHelperBeneficiaryId?: string | null;
  consentHelperName?: string;
  consentHelperPhone?: string;
}): Promise<TitleLookupRecord> {
  const db = await readDb();
  const costKes = input.costKes ?? amountForBillingEvent("title_lookup");
  const now = new Date().toISOString();
  const record: TitleLookupRecord = {
    id: newId(),
    vaultId: input.vaultId,
    assetId: input.assetId,
    reviewRequestId: input.reviewRequestId ?? null,
    titleNumber: input.titleNumber,
    county: input.county,
    parcelNumber: input.parcelNumber || "",
    blockNumber: input.blockNumber || "",
    registrationSection: input.registrationSection || "",
    landRegistryOffice: input.landRegistryOffice || "",
    result: pendingSearchResult(),
    requestedByUserId: input.requestedByUserId,
    costKes,
    ardhiSasaId: input.ardhiSasaId || "",
    ecitizenId: input.ecitizenId || "",
    status: "pending_advocate_submission",
    consentPath: input.consentPath === "family_assisted" ? "family_assisted" : "paper_authorization",
    consentHelperBeneficiaryId: input.consentHelperBeneficiaryId ?? null,
    consentHelperName: input.consentHelperName || "",
    consentHelperPhone: input.consentHelperPhone || "",
    authorizationName: null,
    authorizationPath: null,
    authorizationSignedAt: null,
    familyAlertSentAt: null,
    advocateNotes: input.advocateNotes || "",
    documentName: null,
    documentPath: null,
    filedAt: null,
    certificateUploadedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  db.titleLookups.push(record);
  db.billingRecords.push({
    id: newId(),
    vaultId: input.vaultId,
    actorUserId: input.requestedByUserId,
    kind: "title_lookup",
    detail: `ArdhiSasa filing request · ${input.titleNumber || "(no LR)"} · ${input.county}`,
    amountKes: costKes,
    currency: "KES",
    provider: "till",
    paid: false,
    paidAt: null,
    paidByUserId: null,
    relatedId: record.id,
    createdAt: now,
  });
  await writeDb(db);
  return record;
}

export async function getTitleLookup(
  id: string,
): Promise<TitleLookupRecord | undefined> {
  const db = await readDb();
  return db.titleLookups.find((t) => t.id === id);
}

export async function updateTitleLookup(input: {
  id: string;
  status?: TitleLookupRecord["status"];
  advocateNotes?: string;
  documentName?: string | null;
  documentPath?: string | null;
  reviewRequestId?: string | null;
  consentPath?: TitleLookupRecord["consentPath"];
  consentHelperBeneficiaryId?: string | null;
  consentHelperName?: string;
  consentHelperPhone?: string;
  authorizationName?: string | null;
  authorizationPath?: string | null;
  familyAlertSentAt?: string | null;
}): Promise<TitleLookupRecord | null> {
  const db = await readDb();
  const row = db.titleLookups.find((t) => t.id === input.id);
  if (!row) return null;
  const now = new Date().toISOString();
  if (input.status) row.status = input.status;
  if (typeof input.advocateNotes === "string") row.advocateNotes = input.advocateNotes;
  if (input.reviewRequestId !== undefined) {
    row.reviewRequestId = input.reviewRequestId;
  }
  if (input.documentName !== undefined) row.documentName = input.documentName;
  if (input.documentPath !== undefined) row.documentPath = input.documentPath;
  if (input.consentPath) row.consentPath = input.consentPath;
  if (input.consentHelperBeneficiaryId !== undefined) {
    row.consentHelperBeneficiaryId = input.consentHelperBeneficiaryId;
  }
  if (typeof input.consentHelperName === "string") {
    row.consentHelperName = input.consentHelperName;
  }
  if (typeof input.consentHelperPhone === "string") {
    row.consentHelperPhone = input.consentHelperPhone;
  }
  if (input.authorizationName !== undefined) row.authorizationName = input.authorizationName;
  if (input.authorizationPath !== undefined) {
    row.authorizationPath = input.authorizationPath;
    if (input.authorizationPath) row.authorizationSignedAt = now;
  }
  if (input.familyAlertSentAt !== undefined) {
    row.familyAlertSentAt = input.familyAlertSentAt;
  }
  if (input.status === "awaiting_owner_consent" && !row.filedAt) {
    row.filedAt = now;
    row.result = {
      ...row.result,
      simulated: false,
      registrationStatus: "awaiting_owner_consent",
      rawNote:
        row.consentPath === "family_assisted"
          ? "Search filed on ArdhiSasa. Waiting for the owner (or a family helper) to Approve the notification in the ArdhiSasa portal."
          : "Search filed on ArdhiSasa. Paper authorization is on file (or will be uploaded) so the advocate can complete the search.",
      checkedAt: now,
    };
  }
  if (input.documentPath) {
    row.status = "certificate_on_file";
    row.certificateUploadedAt = now;
    row.result = {
      ...row.result,
      simulated: false,
      found: true,
      registrationStatus: "officially_verified",
      rawNote: "Officially Verified by LSK Advocate. Search certificate stored in the vault.",
      checkedAt: now,
    };
  }
  row.updatedAt = now;
  await writeDb(db);
  return row;
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
    ...blankDiasporaFields(),
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
    enforcer: null,
    minCoSignApprovals: 2,
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
  enforcer?: ExecutionEnforcer | null;
  minCoSignApprovals?: number;
  requireDeathCertificate: boolean;
  requireDeathNotification: boolean;
  coolingHours: number;
  updatedByUserId: string;
}): Promise<ExecutionPlan> {
  const db = await readDb();
  const now = new Date().toISOString();
  const existing = db.executionPlans.find((p) => p.vaultId === input.vaultId);
  const enforcer = input.enforcer ?? existing?.enforcer ?? null;
  const minCoSignApprovals = input.minCoSignApprovals ?? existing?.minCoSignApprovals ?? 2;
  if (existing) {
    existing.trustees = input.trustees;
    existing.minTrusteeApprovals = input.minTrusteeApprovals;
    existing.guardians = input.guardians;
    existing.minGuardianApprovals = input.minGuardianApprovals;
    existing.enforcer = enforcer;
    existing.minCoSignApprovals = minCoSignApprovals;
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
    enforcer,
    minCoSignApprovals,
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

export type SuccessionReleaseGates = {
  trusteeApproved: number;
  trusteeRequired: number;
  guardianApproved: number;
  guardianRequired: number;
  requiresCertificate: boolean;
  hasCertificate: boolean;
  requiresNotification: boolean;
  hasNotification: boolean;
  opsVerified: boolean;
  coolingEndsAt: string | null;
  coolingActive: boolean;
  released: boolean;
  /** Everything still standing between this claim and executor access. */
  blockers: string[];
  canRelease: boolean;
};

function evaluateReleaseGates(
  db: Database,
  successionCase: SuccessionCase,
): SuccessionReleaseGates {
  const plan = db.executionPlans.find(
    (p) => p.vaultId === successionCase.vaultId,
  );
  const { trusteeRequired, guardianRequired } = successionThresholds(
    db,
    successionCase.vaultId,
    successionCase.id,
  );
  const approvals = db.successionApprovals.filter(
    (a) => a.caseId === successionCase.id,
  );
  const trusteeApproved = approvals.filter(
    (a) => a.role === "trustee" && a.status === "approved",
  ).length;
  const guardianApproved = approvals.filter(
    (a) => a.role === "guardian" && a.status === "approved",
  ).length;

  const requiresCertificate = plan?.requireDeathCertificate !== false;
  const hasCertificate = Boolean(successionCase.deathCertificatePath);
  const requiresNotification = Boolean(plan?.requireDeathNotification);
  const hasNotification = Boolean(successionCase.deathNotificationPath);

  const opsVerified =
    successionCase.status === "succession_verified" ||
    successionCase.status === "with_advocate" ||
    successionCase.status === "succession_completed";
  const coolingActive = Boolean(
    successionCase.coolingEndsAt &&
      new Date(successionCase.coolingEndsAt).getTime() > Date.now(),
  );
  const released = Boolean(successionCase.vaultReleasedAt);

  const blockers: string[] = [];
  if (!opsVerified) {
    blockers.push("Ops have not verified this claim yet.");
  }
  if (coolingActive && successionCase.coolingEndsAt) {
    blockers.push(
      `Cooling period is active until ${new Date(successionCase.coolingEndsAt).toLocaleString()}.`,
    );
  }
  if (requiresCertificate && !hasCertificate) {
    blockers.push("Death certificate is missing on this claim.");
  }
  if (requiresNotification && !hasNotification) {
    blockers.push("Official death notification is missing on this claim.");
  }
  if (trusteeApproved < trusteeRequired) {
    blockers.push(
      `Trustee approvals incomplete (${trusteeApproved}/${trusteeRequired}).`,
    );
  }
  if (guardianApproved < guardianRequired) {
    blockers.push(
      `Guardian confirmations incomplete (${guardianApproved}/${guardianRequired}).`,
    );
  }

  return {
    trusteeApproved,
    trusteeRequired,
    guardianApproved,
    guardianRequired,
    requiresCertificate,
    hasCertificate,
    requiresNotification,
    hasNotification,
    opsVerified,
    coolingEndsAt: successionCase.coolingEndsAt,
    coolingActive,
    released,
    blockers,
    canRelease: !released && blockers.length === 0,
  };
}

/**
 * Server-evaluated release gates. The UI renders these rather than recomputing
 * the rules (and a wall clock) in the browser.
 */
export async function getSuccessionReleaseGates(
  caseId: string,
): Promise<SuccessionReleaseGates | null> {
  const db = await readDb();
  const successionCase = db.successionCases.find((c) => c.id === caseId);
  if (!successionCase) return null;
  return evaluateReleaseGates(db, successionCase);
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

  const gates = evaluateReleaseGates(db, successionCase);
  if (!gates.canRelease) {
    throw new Error(gates.blockers[0] || "This claim cannot be released yet.");
  }

  const now = new Date().toISOString();
  successionCase.vaultReleasedAt = now;
  successionCase.vaultReleasedByUserId = input.adminUserId;
  successionCase.releaseNotes = input.releaseNotes.trim();
  successionCase.updatedAt = now;

  await writeDb(db);
  return successionCase;
}

function canOpenReleased(
  db: Database,
  successionCase: SuccessionCase,
  userId: string,
  phone: string,
): boolean {
  if (!successionCase.vaultReleasedAt) return false;

  const confirmed = db.successionApprovals.some(
    (a) =>
      a.caseId === successionCase.id &&
      a.status === "approved" &&
      (a.userId === userId || phonesEqual(a.trusteePhone, phone)),
  );
  if (confirmed) return true;

  return db.beneficiaries.some(
    (b) =>
      b.vaultId === successionCase.vaultId &&
      Boolean(b.phone) &&
      phonesEqual(b.phone, phone),
  );
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
  if (!successionCase) return false;
  return canOpenReleased(db, successionCase, input.userId, input.phone);
}

export async function listReleasedCasesForUser(input: {
  userId: string;
  phone: string;
}): Promise<Array<{ caseId: string; vaultId: string; ownerName: string }>> {
  const db = await readDb();
  return db.successionCases
    .filter((successionCase) =>
      canOpenReleased(db, successionCase, input.userId, input.phone),
    )
    .map((successionCase) => {
      const vault = db.vaults.find((v) => v.id === successionCase.vaultId);
      const owner = vault
        ? db.users.find((u) => u.id === vault.ownerId)
        : undefined;
      return {
        caseId: successionCase.id,
        vaultId: successionCase.vaultId,
        ownerName: owner?.fullName || "Elder",
      };
    });
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
        ...blankDiasporaFields(),
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

/** Resolve a stored path (absolute or relative under uploads/). */
export function resolveStoredFilePath(stored: string): string {
  if (path.isAbsolute(stored)) return stored;
  return path.join(uploadsDir(), blobKey(stored));
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
    currency: "KES",
    provider: "till",
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
          await deleteStoredFile(doc.documentPath);
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
  input: {
    reviewRequestId?: string | null;
    vaultId: string;
    advocateId: string;
    mode: ConsultBooking["mode"];
    scheduledAt: string;
    notes?: string;
    status?: ConsultBooking["status"];
    kind?: ConsultBooking["kind"];
    diasporaSignerName?: string;
    diasporaSignerPhone?: string;
    meetingUrl?: string;
  },
): Promise<ConsultBooking> {
  const db = await readDb();
  const row: ConsultBooking = {
    id: newId(),
    reviewRequestId: input.reviewRequestId ?? null,
    vaultId: input.vaultId,
    advocateId: input.advocateId,
    mode: input.mode,
    scheduledAt: input.scheduledAt,
    notes: input.notes || "",
    status: input.status || "scheduled",
    kind: input.kind || "consult",
    diasporaSignerName: input.diasporaSignerName || "",
    diasporaSignerPhone: input.diasporaSignerPhone || "",
    meetingUrl: input.meetingUrl || "",
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

export async function listConsultBookingsForVault(
  vaultId: string,
): Promise<ConsultBooking[]> {
  const db = await readDb();
  return db.consultBookings
    .filter((c) => c.vaultId === vaultId)
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
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

export async function saveWillDraft(
  vaultId: string,
  draft: Omit<WillDraft, "updatedAt">,
): Promise<WillDraft> {
  const db = await readDb();
  const vault = db.vaults.find((v) => v.id === vaultId);
  if (!vault) throw new Error("Vault not found");
  const saved: WillDraft = {
    ...draft,
    testamentaryTrustEnabled: Boolean(draft.testamentaryTrustEnabled),
    testamentaryTrustTerms: draft.testamentaryTrustTerms || "",
    testamentaryTrustUntilAge: draft.testamentaryTrustUntilAge || 18,
    updatedAt: new Date().toISOString(),
  };
  vault.willDraft = saved;
  vault.updatedAt = saved.updatedAt;
  await writeDb(db);
  return saved;
}

export async function saveTrustDraft(
  vaultId: string,
  draft: Omit<TrustDraft, "updatedAt">,
): Promise<TrustDraft> {
  const db = await readDb();
  const vault = db.vaults.find((v) => v.id === vaultId);
  if (!vault) throw new Error("Vault not found");
  const saved: TrustDraft = {
    ...draft,
    enforcerName: draft.enforcerName || "",
    enforcerPhone: draft.enforcerPhone || "",
    enforcerIdNumber: draft.enforcerIdNumber || "",
    enforcerOrganization: draft.enforcerOrganization || "",
    minCoSignApprovals: draft.minCoSignApprovals || 2,
    updatedAt: new Date().toISOString(),
  };
  vault.trustDraft = saved;
  vault.updatedAt = saved.updatedAt;
  await writeDb(db);
  return saved;
}

export async function saveBurialWishes(
  vaultId: string,
  wishes: Omit<BurialWishes, "updatedAt">,
): Promise<BurialWishes> {
  const db = await readDb();
  const vault = db.vaults.find((v) => v.id === vaultId);
  if (!vault) throw new Error("Vault not found");
  const saved: BurialWishes = {
    ...wishes,
    burialPlotTitle: wishes.burialPlotTitle || "",
    burialGpsLat: wishes.burialGpsLat ?? null,
    burialGpsLng: wishes.burialGpsLng ?? null,
    clanEldersToInvolve: wishes.clanEldersToInvolve || "",
    culturalTraditions: wishes.culturalTraditions || "",
    saccoNomineeName: wishes.saccoNomineeName || "",
    saccoNomineePhone: wishes.saccoNomineePhone || "",
    saccoAccount: wishes.saccoAccount || "",
    mpesaNomineePhone: wishes.mpesaNomineePhone || "",
    insurancePolicyRef: wishes.insurancePolicyRef || "",
    liquidityNotes: wishes.liquidityNotes || "",
    updatedAt: new Date().toISOString(),
  };
  vault.burialWishes = saved;
  vault.updatedAt = saved.updatedAt;
  await writeDb(db);
  return saved;
}

export async function queueOutboundNotice(input: {
  vaultId: string | null;
  channel: "whatsapp" | "sms";
  toPhone: string;
  body: string;
  relatedAction: string;
  status?: OutboundNotice["status"];
  error?: string | null;
}): Promise<OutboundNotice> {
  const db = await readDb();
  const notice: OutboundNotice = {
    id: newId(),
    vaultId: input.vaultId,
    channel: input.channel,
    toPhone: input.toPhone,
    body: input.body,
    status: input.status || "queued",
    relatedAction: input.relatedAction,
    createdAt: new Date().toISOString(),
    sentAt: input.status === "sent" ? new Date().toISOString() : null,
    error: input.error || null,
  };
  db.outboundNotices.push(notice);
  await writeDb(db);
  return notice;
}

export async function listOutboundNotices(): Promise<OutboundNotice[]> {
  const db = await readDb();
  return [...db.outboundNotices].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function listDisputedAssets(): Promise<
  Array<{ asset: Asset; vaultId: string; ownerName: string; phone: string }>
> {
  const db = await readDb();
  const rows = [];
  for (const asset of db.assets) {
    if (!asset.disputeFlag && !asset.familyAlert) continue;
    const vault = db.vaults.find((v) => v.id === asset.vaultId);
    const owner = vault
      ? db.users.find((u) => u.id === vault.ownerId)
      : undefined;
    rows.push({
      asset,
      vaultId: asset.vaultId,
      ownerName: owner?.fullName || "Unknown",
      phone: owner?.phone || "",
    });
  }
  return rows;
}

export async function listDsarRequests(): Promise<DsarRequest[]> {
  const db = await readDb();
  return [...db.dsarRequests].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function createDsarRequest(
  input: Omit<DsarRequest, "id" | "createdAt" | "fulfilledAt">,
): Promise<DsarRequest> {
  const db = await readDb();
  const row: DsarRequest = {
    id: newId(),
    ...input,
    createdAt: new Date().toISOString(),
    fulfilledAt: input.status === "fulfilled" ? new Date().toISOString() : null,
  };
  db.dsarRequests.push(row);
  await writeDb(db);
  return row;
}

export async function updateDsarRequest(input: {
  id: string;
  status: DsarStatus;
  notes?: string;
}): Promise<DsarRequest | undefined> {
  const db = await readDb();
  const row = db.dsarRequests.find((d) => d.id === input.id);
  if (!row) return undefined;
  row.status = input.status;
  if (typeof input.notes === "string") row.notes = input.notes;
  if (input.status === "fulfilled") row.fulfilledAt = new Date().toISOString();
  await writeDb(db);
  return row;
}

export async function listMarketingLeads(): Promise<MarketingLead[]> {
  const db = await readDb();
  return [...db.marketingLeads].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function updateUserDiasporaProfile(
  userId: string,
  input: {
    diasporaNationalId?: string;
    ecitizenId?: string;
    ardhiSasaId?: string;
    passportNumber?: string;
    passportCountry?: string;
    countryOfResidence?: string;
    isDiaspora?: boolean;
  },
): Promise<User | null> {
  const db = await readDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return null;
  if (typeof input.diasporaNationalId === "string") {
    user.diasporaNationalId = input.diasporaNationalId.trim();
  }
  if (typeof input.ecitizenId === "string") user.ecitizenId = input.ecitizenId.trim();
  if (typeof input.ardhiSasaId === "string") user.ardhiSasaId = input.ardhiSasaId.trim();
  if (typeof input.passportNumber === "string") {
    user.passportNumber = input.passportNumber.trim();
  }
  if (typeof input.passportCountry === "string") {
    user.passportCountry = input.passportCountry.trim();
  }
  if (typeof input.countryOfResidence === "string") {
    user.countryOfResidence = input.countryOfResidence.trim();
  }
  if (typeof input.isDiaspora === "boolean") user.isDiaspora = input.isDiaspora;
  if (
    user.countryOfResidence &&
    user.countryOfResidence.toLowerCase() !== "kenya"
  ) {
    user.isDiaspora = true;
  }
  await writeDb(db);
  return user;
}

export async function listHouseholdHouses(
  vaultId: string,
): Promise<HouseholdHouse[]> {
  const db = await readDb();
  return db.householdHouses.filter((h) => h.vaultId === vaultId);
}

export async function saveHouseholdHouse(input: {
  id?: string;
  vaultId: string;
  houseLabel: string;
  wifeName: string;
  notes: string;
  allocatedAssetIds: string[];
}): Promise<HouseholdHouse> {
  const db = await readDb();
  const now = new Date().toISOString();
  if (input.id) {
    const existing = db.householdHouses.find(
      (h) => h.id === input.id && h.vaultId === input.vaultId,
    );
    if (existing) {
      existing.houseLabel = input.houseLabel.trim();
      existing.wifeName = input.wifeName.trim();
      existing.notes = input.notes.trim();
      existing.allocatedAssetIds = input.allocatedAssetIds;
      existing.updatedAt = now;
      await writeDb(db);
      return existing;
    }
  }
  const created: HouseholdHouse = {
    id: newId(),
    vaultId: input.vaultId,
    houseLabel: input.houseLabel.trim(),
    wifeName: input.wifeName.trim(),
    notes: input.notes.trim(),
    allocatedAssetIds: input.allocatedAssetIds,
    createdAt: now,
    updatedAt: now,
  };
  db.householdHouses.push(created);
  await writeDb(db);
  return created;
}

export async function deleteHouseholdHouse(
  vaultId: string,
  houseId: string,
): Promise<boolean> {
  const db = await readDb();
  const before = db.householdHouses.length;
  db.householdHouses = db.householdHouses.filter(
    (h) => !(h.vaultId === vaultId && h.id === houseId),
  );
  for (const heir of db.beneficiaries) {
    if (heir.vaultId === vaultId && heir.houseId === houseId) heir.houseId = null;
  }
  if (db.householdHouses.length === before) return false;
  await writeDb(db);
  return true;
}

function consensusRoleForUser(input: {
  user: User;
  vault: Vault;
  asAgent: boolean;
  plan: ExecutionPlan | undefined;
  heirs: Beneficiary[];
}): ConsensusSignerRole | null {
  if (input.user.id === input.vault.ownerId) return "settlor";
  const phone = input.user.phone;
  if (
    input.plan?.enforcer?.phone &&
    phonesEqual(input.plan.enforcer.phone, phone)
  ) {
    return "enforcer";
  }
  if (
    (input.plan?.trustees || []).some((t) => phonesEqual(t.phone, phone))
  ) {
    return "trustee";
  }
  if (input.heirs.some((h) => h.phone && phonesEqual(h.phone, phone))) {
    return "heir";
  }
  if (input.asAgent) return "family_rep";
  return null;
}

export async function listConsensusProposals(
  vaultId: string,
): Promise<ConsensusProposal[]> {
  const db = await readDb();
  return db.consensusProposals
    .filter((p) => p.vaultId === vaultId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createConsensusProposal(input: {
  vaultId: string;
  kind: ConsensusProposalKind;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  proposedByUserId: string;
  requiredApprovals?: number;
}): Promise<ConsensusProposal> {
  const db = await readDb();
  const plan = db.executionPlans.find((p) => p.vaultId === input.vaultId);
  const row: ConsensusProposal = {
    id: newId(),
    vaultId: input.vaultId,
    kind: input.kind,
    title: input.title.trim(),
    summary: input.summary.trim(),
    payload: input.payload,
    proposedByUserId: input.proposedByUserId,
    requiredApprovals:
      input.requiredApprovals ||
      plan?.minCoSignApprovals ||
      2,
    status: "open",
    signatures: [],
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
  db.consensusProposals.push(row);
  await writeDb(db);
  return row;
}

export async function signConsensusProposal(input: {
  proposalId: string;
  vaultId: string;
  userId: string;
  asAgent: boolean;
}): Promise<{ proposal: ConsensusProposal; error?: string }> {
  const db = await readDb();
  const proposal = db.consensusProposals.find(
    (p) => p.id === input.proposalId && p.vaultId === input.vaultId,
  );
  if (!proposal) return { proposal: proposal as unknown as ConsensusProposal, error: "Proposal not found." };
  if (proposal.status !== "open") {
    return { proposal, error: "This proposal is no longer open for signatures." };
  }
  if (proposal.signatures.some((s) => s.userId === input.userId)) {
    return { proposal, error: "You have already signed this proposal." };
  }
  const user = db.users.find((u) => u.id === input.userId);
  const vault = db.vaults.find((v) => v.id === input.vaultId);
  if (!user || !vault) return { proposal, error: "Vault or signer not found." };
  const plan = db.executionPlans.find((p) => p.vaultId === input.vaultId);
  const heirs = db.beneficiaries.filter((b) => b.vaultId === input.vaultId);
  const role = consensusRoleForUser({
    user,
    vault,
    asAgent: input.asAgent,
    plan,
    heirs,
  });
  if (!role) {
    return {
      proposal,
      error: "Only the settlor, a named trustee, the enforcer, an heir, or a family agent can co-sign.",
    };
  }
  proposal.signatures.push({
    userId: user.id,
    signerName: user.fullName,
    signerPhone: user.phone,
    role,
    signedAt: new Date().toISOString(),
  });
  if (proposal.signatures.length >= proposal.requiredApprovals) {
    proposal.status = "approved";
    proposal.resolvedAt = new Date().toISOString();
  }
  await writeDb(db);
  return { proposal };
}

export async function executeConsensusProposal(input: {
  proposalId: string;
  vaultId: string;
  userId: string;
}): Promise<{ proposal: ConsensusProposal; buyout?: BuyoutOffer; error?: string }> {
  const db = await readDb();
  const proposal = db.consensusProposals.find(
    (p) => p.id === input.proposalId && p.vaultId === input.vaultId,
  );
  if (!proposal) {
    return { proposal: proposal as unknown as ConsensusProposal, error: "Proposal not found." };
  }
  if (proposal.status !== "approved") {
    return { proposal, error: "Need dual-signature approval before this action is logged." };
  }
  const vault = db.vaults.find((v) => v.id === input.vaultId);
  if (!vault) return { proposal, error: "Vault not found." };
  const now = new Date().toISOString();
  let buyout: BuyoutOffer | undefined;
  if (proposal.kind === "amend_trust") {
    const payload = proposal.payload as Partial<TrustDraft>;
    vault.trustDraft = {
      trustName: String(payload.trustName || vault.trustDraft?.trustName || ""),
      primaryTrustee: String(
        payload.primaryTrustee || vault.trustDraft?.primaryTrustee || "",
      ),
      coTrustee: String(payload.coTrustee || vault.trustDraft?.coTrustee || ""),
      titleNumbers: String(
        payload.titleNumbers || vault.trustDraft?.titleNumbers || "",
      ),
      conditions: String(payload.conditions || vault.trustDraft?.conditions || ""),
      enforcerName: String(
        payload.enforcerName || vault.trustDraft?.enforcerName || "",
      ),
      enforcerPhone: String(
        payload.enforcerPhone || vault.trustDraft?.enforcerPhone || "",
      ),
      enforcerIdNumber: String(
        payload.enforcerIdNumber || vault.trustDraft?.enforcerIdNumber || "",
      ),
      enforcerOrganization: String(
        payload.enforcerOrganization || vault.trustDraft?.enforcerOrganization || "",
      ),
      minCoSignApprovals:
        typeof payload.minCoSignApprovals === "number"
          ? payload.minCoSignApprovals
          : vault.trustDraft?.minCoSignApprovals || 2,
      updatedAt: now,
    };
    vault.updatedAt = now;
  }
  if (proposal.kind === "liquidate_share") {
    const sellerBeneficiaryId = String(proposal.payload.sellerBeneficiaryId || "");
    const sharePercent = Number(proposal.payload.sharePercent) || 0;
    const askingPriceKes = Number(proposal.payload.askingPriceKes) || 0;
    const assetId = proposal.payload.assetId
      ? String(proposal.payload.assetId)
      : null;
    const windowDays = Number(proposal.payload.windowDays) || 14;
    const ends = new Date();
    ends.setDate(ends.getDate() + windowDays);
    buyout = {
      id: newId(),
      vaultId: input.vaultId,
      proposalId: proposal.id,
      sellerBeneficiaryId,
      assetId,
      sharePercent,
      askingPriceKes,
      status: "open",
      windowEndsAt: ends.toISOString(),
      responses: [],
      acceptedByBeneficiaryId: null,
      createdAt: now,
      updatedAt: now,
    };
    db.buyoutOffers.push(buyout);
  }
  proposal.status = "executed";
  proposal.resolvedAt = now;
  await writeDb(db);
  return { proposal, buyout };
}

export async function rejectConsensusProposal(input: {
  proposalId: string;
  vaultId: string;
}): Promise<ConsensusProposal | null> {
  const db = await readDb();
  const proposal = db.consensusProposals.find(
    (p) => p.id === input.proposalId && p.vaultId === input.vaultId,
  );
  if (!proposal || proposal.status !== "open") return proposal || null;
  proposal.status = "rejected";
  proposal.resolvedAt = new Date().toISOString();
  await writeDb(db);
  return proposal;
}

export async function listBuyoutOffers(vaultId: string): Promise<BuyoutOffer[]> {
  const db = await readDb();
  const now = Date.now();
  let dirty = false;
  for (const offer of db.buyoutOffers) {
    if (offer.vaultId !== vaultId) continue;
    if (offer.status === "open" && new Date(offer.windowEndsAt).getTime() < now) {
      offer.status = "open_market";
      offer.updatedAt = new Date().toISOString();
      dirty = true;
    }
  }
  if (dirty) await writeDb(db);
  return db.buyoutOffers
    .filter((o) => o.vaultId === vaultId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createBuyoutOffer(input: {
  vaultId: string;
  proposalId?: string | null;
  sellerBeneficiaryId: string;
  assetId: string | null;
  sharePercent: number;
  askingPriceKes: number;
  windowDays?: number;
}): Promise<BuyoutOffer> {
  const db = await readDb();
  const now = new Date();
  const ends = new Date(now);
  ends.setDate(ends.getDate() + (input.windowDays || 14));
  const offer: BuyoutOffer = {
    id: newId(),
    vaultId: input.vaultId,
    proposalId: input.proposalId || null,
    sellerBeneficiaryId: input.sellerBeneficiaryId,
    assetId: input.assetId,
    sharePercent: input.sharePercent,
    askingPriceKes: input.askingPriceKes,
    status: "open",
    windowEndsAt: ends.toISOString(),
    responses: [],
    acceptedByBeneficiaryId: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  db.buyoutOffers.push(offer);
  await writeDb(db);
  return offer;
}

export async function respondToBuyout(input: {
  offerId: string;
  vaultId: string;
  beneficiaryId: string;
  responderName: string;
  decision: "accept" | "decline";
  offerKes: number | null;
}): Promise<{ offer: BuyoutOffer | null; error?: string }> {
  const db = await readDb();
  const offer = db.buyoutOffers.find(
    (o) => o.id === input.offerId && o.vaultId === input.vaultId,
  );
  if (!offer) return { offer: null, error: "Buyout offer not found." };
  if (offer.status !== "open") {
    return { offer, error: "This first-right window is closed." };
  }
  if (new Date(offer.windowEndsAt).getTime() < Date.now()) {
    offer.status = "open_market";
    offer.updatedAt = new Date().toISOString();
    await writeDb(db);
    return { offer, error: "The family window expired. Share may be offered outside." };
  }
  if (offer.sellerBeneficiaryId === input.beneficiaryId) {
    return { offer, error: "The selling heir cannot buy their own share." };
  }
  offer.responses = offer.responses.filter(
    (r) => r.beneficiaryId !== input.beneficiaryId,
  );
  offer.responses.push({
    beneficiaryId: input.beneficiaryId,
    responderName: input.responderName,
    decision: input.decision,
    offerKes: input.offerKes,
    createdAt: new Date().toISOString(),
  });
  if (input.decision === "accept") {
    const bid = input.offerKes ?? offer.askingPriceKes;
    if (bid >= offer.askingPriceKes) {
      offer.status = "family_accepted";
      offer.acceptedByBeneficiaryId = input.beneficiaryId;
    }
  }
  offer.updatedAt = new Date().toISOString();
  await writeDb(db);
  return { offer };
}

export async function listPaymentCheckouts(
  vaultId: string,
): Promise<PaymentCheckout[]> {
  const db = await readDb();
  return db.paymentCheckouts
    .filter((c) => c.vaultId === vaultId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listAllPaymentCheckouts(): Promise<PaymentCheckout[]> {
  const db = await readDb();
  return [...db.paymentCheckouts].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

function billingKindFromCheckout(kind: CheckoutKind): BillingKind {
  if (kind === "amendment") return "amendment_submitted";
  if (kind === "review") return "review_submitted";
  if (kind === "title_lookup") return "title_lookup";
  if (kind === "estate_maintenance") return "estate_maintenance";
  return "advocate_fee";
}

export async function createPaymentCheckout(input: {
  vaultId: string;
  actorUserId: string;
  kind: CheckoutKind;
  currency: CheckoutCurrency;
  amount: number;
  mpesaPhone?: string;
  detail?: string;
}): Promise<PaymentCheckout> {
  const db = await readDb();
  const now = new Date().toISOString();
  const amountKes = toKesEquivalent(input.amount, input.currency);
  const reference = `ST${newId().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  const detail =
    input.detail ||
    `${input.kind.replace(/_/g, " ")} · ${input.currency} ${input.amount}`;
  const preferredProvider: CheckoutProvider =
    input.currency === "KES" ? "mpesa" : "stripe";
  const checkout: PaymentCheckout = {
    id: newId(),
    vaultId: input.vaultId,
    actorUserId: input.actorUserId,
    kind: input.kind,
    currency: input.currency,
    amount: input.amount,
    amountKesEquivalent: amountKes,
    provider: "queued",
    status: "pending",
    mpesaPhone: input.mpesaPhone || "",
    mpesaReceipt: null,
    stripeSessionId: null,
    reference,
    detail,
    gatewayNote: "",
    createdAt: now,
    updatedAt: now,
  };
  try {
    const attempt = await attemptCheckoutGateway({
      currency: input.currency,
      amount: input.amount,
      amountKes,
      phone: input.mpesaPhone || "",
      reference,
      detail,
    });
    checkout.provider =
      attempt.provider === "queued" ? preferredProvider : attempt.provider;
    checkout.status =
      attempt.status === "initiated"
        ? "initiated"
        : attempt.status === "failed"
          ? "queued"
          : "queued";
    checkout.gatewayNote = attempt.note;
    checkout.stripeSessionId = attempt.stripeSessionId;
    checkout.mpesaReceipt = attempt.mpesaReceipt;
  } catch {
    checkout.provider = preferredProvider;
    checkout.status = "queued";
    checkout.gatewayNote =
      "Gateway attempt failed; checkout recorded so ops can collect payment.";
  }
  db.paymentCheckouts.push(checkout);
  db.billingRecords.push({
    id: newId(),
    vaultId: input.vaultId,
    actorUserId: input.actorUserId,
    kind: billingKindFromCheckout(input.kind),
    detail: `${detail} · ${checkout.provider} ${checkout.status}`,
    amountKes,
    currency: input.currency,
    provider: checkout.provider,
    paid: false,
    paidAt: null,
    paidByUserId: null,
    relatedId: checkout.id,
    createdAt: now,
  });
  await writeDb(db);
  return checkout;
}

export async function setPaymentCheckoutPaid(
  id: string,
  paidByUserId: string,
): Promise<PaymentCheckout | null> {
  const db = await readDb();
  const row = db.paymentCheckouts.find((c) => c.id === id);
  if (!row) return null;
  row.status = "paid";
  row.updatedAt = new Date().toISOString();
  for (const bill of db.billingRecords) {
    if (bill.relatedId === id) {
      bill.paid = true;
      bill.paidAt = row.updatedAt;
      bill.paidByUserId = paidByUserId;
    }
  }
  await writeDb(db);
  return row;
}

