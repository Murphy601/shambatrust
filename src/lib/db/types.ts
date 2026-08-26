import type { SpokenLanguage } from "@/lib/languages";

export type UserRole = "elder" | "agent" | "advocate" | "admin";

export type OpsSeatRole = "super" | "reviewer" | "finance" | "compliance";

/** Elder consent copy version recorded on review submit */
export const ELDER_CONSENT_VERSION = "2026-04-v1";

export type AssetType =
  | "land"
  | "commercial_plot"
  | "business"
  | "vehicle"
  | "bank_account"
  | "sacco"
  | "other";

export type VaultStatus = "draft" | "pending_review" | "in_review" | "sealed";

export type PackageTier = "vault" | "standard" | "premium";

export type LegalDocumentType = "will" | "land_trust" | "poa";

export type LegalDocumentStatus =
  | "draft"
  | "ready_for_sign"
  | "signed"
  | "certified";

export type User = {
  id: string;
  phone: string;
  /** Optional login / contact email (unique when set) */
  email: string | null;
  fullName: string;
  role: UserRole;
  locale: "en" | "sw";
  /**
   * Mother tongue used for audio-guided forms and voice testaments.
   * Independent of `locale`, which only drives the translated UI chrome.
   */
  preferredLanguage: SpokenLanguage;
  /** Elder opted into spoken prompts on long forms */
  audioGuidance: boolean;
  /** Elder signup KYC — national ID scans */
  idFrontName: string | null;
  idFrontPath: string | null;
  idBackName: string | null;
  idBackPath: string | null;
  /** Home / postal address from signup */
  address: string;
  county: string;
  /**
   * True after signup KYC (or migrated legacy accounts).
   * Returning login is OTP-only once this is true.
   */
  profileComplete: boolean;
  advocateLicense: string | null;
  /** Ops desk seat (admins only) */
  opsSeat: OpsSeatRole | null;
  /** Counties an advocate practises in — drives automated case matching */
  advocateCounties: string[];
  /** Advocate CRM */
  advocateSuspended: boolean;
  advocateMaxCases: number | null;
  advocateOooUntil: string | null;
  advocateOooNote: string;
  createdAt: string;
};

export type VaultSetupStep =
  | "assets"
  | "heirs"
  | "allocations"
  | "ready_for_review"
  | "submitted";

export type Vault = {
  id: string;
  ownerId: string;
  status: VaultStatus;
  packageTier: PackageTier | null;
  binderRequested: boolean;
  /** Guided wizard progress; free edits until submitted */
  setupStep: VaultSetupStep;
  /** Elder reopened vault to add/change content after a prior submit */
  amendmentOpen: boolean;
  amendmentOpenedAt: string | null;
  /** Status before amendment reopen (restored conceptually on resubmit → pending_review) */
  statusBeforeAmendment: VaultStatus | null;
  /** True if amendment reopen already logged a paid billing_event */
  amendmentFeeCharged: boolean;
  /** Ops force-lock — blocks elder edits even in draft */
  forceLocked: boolean;
  opsNotes: string;
  willDraft: WillDraft | null;
  trustDraft: TrustDraft | null;
  burialWishes: BurialWishes | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * A SACCO nominee. SACCO bylaws distribute a member's deposits by nominated
 * percentage outside the estate, so these are recorded per-account and kept
 * separate from vault `Allocation` rows.
 */
export type SaccoNominee = {
  id: string;
  fullName: string;
  idNumber: string;
  phone: string;
  relationship: string;
  /** Share of this SACCO account, 0–100 */
  percentage: number;
};

export type WillDraft = {
  testatorName: string;
  testatorId: string;
  primaryResidence: string;
  executorName: string;
  executorPhone: string;
  altExecutorName: string;
  altExecutorPhone: string;
  guardianName: string;
  guardianPhone: string;
  altGuardianName: string;
  witnessAcknowledged: boolean;
  notes: string;
  updatedAt: string;
};

export type TrustDraft = {
  trustName: string;
  primaryTrustee: string;
  coTrustee: string;
  titleNumbers: string;
  conditions: string;
  updatedAt: string;
};

export type BurialWishes = {
  burialLocation: "ancestral" | "cemetery" | "undecided";
  burialDetails: string;
  committeeLead1: string;
  committeeLead2: string;
  specialMessage: string;
  updatedAt: string;
};

export type DsarStatus = "received" | "in_progress" | "fulfilled" | "refused";

export type DsarRequest = {
  id: string;
  elderUserId: string | null;
  requesterName: string;
  requesterPhone: string;
  requestType: "access" | "correction" | "deletion" | "restriction";
  status: DsarStatus;
  notes: string;
  createdAt: string;
  fulfilledAt: string | null;
};

export type OutboundNotice = {
  id: string;
  vaultId: string | null;
  channel: "whatsapp" | "sms";
  toPhone: string;
  body: string;
  status: "queued" | "sent" | "failed";
  relatedAction: string;
  createdAt: string;
  sentAt: string | null;
  error: string | null;
};

export type Asset = {
  id: string;
  vaultId: string;
  type: AssetType;
  title: string;
  notes: string;
  documentName: string | null;
  documentPath: string | null;
  // Land / commercial plot
  titleNumber: string;
  county: string;
  subCounty: string;
  landmark: string;
  gpsLat: number | null;
  gpsLng: number | null;
  // Land / commercial plot — ArdhiSasa parcel search identifiers
  parcelNumber: string;
  blockNumber: string;
  registrationSection: string;
  landRegistryOffice: string;
  // Vehicle
  registrationNumber: string;
  makeModel: string;
  year: string;
  // Bank account
  bankName: string;
  accountNumber: string;
  accountType: string;
  // Business
  businessRegNumber: string;
  kraPin: string;
  // SACCO / mobile money
  saccoName: string;
  saccoMemberNumber: string;
  saccoNominees: SaccoNominee[];
  mpesaNumber: string;
  disputeFlag: boolean;
  disputeNotes: string;
  familyAlert: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Beneficiary = {
  id: string;
  vaultId: string;
  fullName: string;
  idNumber: string;
  phone: string;
  relationship: string;
  createdAt: string;
};

export type Allocation = {
  id: string;
  vaultId: string;
  beneficiaryId: string;
  assetId: string | null;
  percentage: number | null;
  specificGift: string;
  createdAt: string;
};

export type AgentLink = {
  id: string;
  vaultId: string;
  elderUserId: string;
  agentUserId: string | null;
  agentPhone: string;
  status: "pending" | "active" | "revoked";
  createdAt: string;
};

export type PendingChange = {
  id: string;
  vaultId: string;
  requestedByUserId: string;
  action: string;
  payload: Record<string, unknown>;
  status: "pending_elder_otp" | "approved" | "rejected";
  createdAt: string;
};

export type ChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  notes: string;
};

export type ReviewRequest = {
  id: string;
  vaultId: string;
  packageTier: PackageTier;
  consultMode: "whatsapp" | "video" | "in_person";
  notes: string;
  status: "submitted" | "assigned" | "completed";
  advocateId: string | null;
  assignedAt: string | null;
  completedAt: string | null;
  consultScheduledAt: string | null;
  consultNotes: string;
  checklist: ChecklistItem[];
  /** Elder accepted advocate/doc sharing notice */
  consentAcceptedAt: string | null;
  consentVersion: string | null;
  /** Set when vault is sealed — advocate file access ends */
  docAccessRevokedAt: string | null;
  createdAt: string;
};

export type LegalDocument = {
  id: string;
  reviewRequestId: string;
  vaultId: string;
  type: LegalDocumentType;
  status: LegalDocumentStatus;
  title: string;
  body: string;
  documentName: string | null;
  documentPath: string | null;
  signatureName: string | null;
  signedAt: string | null;
  signedByUserId: string | null;
  /** Advocate legal stamp — applied before e-signature */
  stampRef: string | null;
  stampedAt: string | null;
  stampedByUserId: string | null;
  stampAdvocateName: string;
  stampLskNumber: string;
  stampCounty: string;
  stampNotes: string;
  createdAt: string;
  updatedAt: string;
};

export type TranscriptStatus =
  | "pending"
  | "in_progress"
  | "transcribed"
  | "rejected";

/**
 * A spoken instruction recorded by (or for) an elder, in their own language.
 *
 * The recording is evidence of intent that supports the written dossier; it is
 * never a substitute for the advocate-drafted will. Transcripts are entered by
 * ops or the assigned advocate and attached to the case.
 */
export type AudioTestament = {
  id: string;
  vaultId: string;
  /** Optional link to a specific asset the elder was speaking about */
  assetId: string | null;
  recordedByUserId: string;
  /** True when a family agent captured the recording on the elder's behalf */
  recordedByAgent: boolean;
  title: string;
  language: SpokenLanguage;
  documentName: string;
  /** Relative filename under uploads/testaments/ */
  documentPath: string;
  mimeType: string;
  fileSize: number;
  durationSeconds: number | null;
  transcript: string;
  transcriptStatus: TranscriptStatus;
  transcribedByUserId: string | null;
  transcribedAt: string | null;
  transcriptNotes: string;
  createdAt: string;
  updatedAt: string;
};

export type TitleLookupResult = {
  found: boolean;
  simulated: true;
  ownerName: string | null;
  registrationStatus: string;
  approximateLocation: string | null;
  caveats: string[];
  checkedAt: string;
  rawNote: string;
};

export type TitleLookupRecord = {
  id: string;
  vaultId: string;
  assetId: string | null;
  reviewRequestId: string | null;
  titleNumber: string;
  county: string;
  result: TitleLookupResult;
  requestedByUserId: string;
  costKes: number;
  createdAt: string;
};

export type BillingKind =
  | "review_submitted"
  | "amendment_opened"
  | "amendment_submitted"
  | "title_lookup";

export type BillingRecord = {
  id: string;
  vaultId: string | null;
  actorUserId: string;
  kind: BillingKind;
  detail: string;
  amountKes: number;
  paid: boolean;
  paidAt: string | null;
  paidByUserId: string | null;
  relatedId: string | null;
  createdAt: string;
};

export type SupportSession = {
  id: string;
  adminUserId: string;
  elderUserId: string;
  vaultId: string;
  expiresAt: string;
  createdAt: string;
  note: string;
};

export type CaseMessage = {
  id: string;
  reviewRequestId: string;
  vaultId: string;
  fromUserId: string;
  fromRole: "advocate" | "ops" | "elder";
  to: "elder" | "ops" | "advocate";
  body: string;
  createdAt: string;
};

export type ConsultBooking = {
  id: string;
  reviewRequestId: string;
  vaultId: string;
  advocateId: string;
  mode: "whatsapp" | "video" | "in_person";
  scheduledAt: string;
  notes: string;
  status: "scheduled" | "done" | "cancelled";
  createdAt: string;
};

export type MarketingLead = {
  id: string;
  fullName: string;
  phone: string;
  locale: "en" | "sw";
  source: "audit" | "referral" | "whatsapp_bot" | "status_tracker" | "other";
  auditScore: number | null;
  auditAnswers: Record<string, string> | null;
  referralCode: string | null;
  notes: string;
  createdAt: string;
};

export type PublicStatusToken = {
  token: string;
  vaultId: string;
  reviewRequestId: string;
  createdAt: string;
};

/**
 * Immutable sealed vault binder PDF — one version per successful seal.
 * Stored under .data/uploads/binders/ and exempt from retention purge.
 */
export type VaultBinderStatus = "generating" | "ready" | "failed";

export type VaultBinder = {
  id: string;
  vaultId: string;
  reviewRequestId: string;
  version: number;
  status: VaultBinderStatus;
  documentName: string;
  /** Relative filename under binders/ */
  documentPath: string | null;
  fileHash: string | null;
  pageCount: number | null;
  error: string | null;
  advocateUserId: string | null;
  advocateName: string;
  sealedAt: string;
  createdAt: string;
  completedAt: string | null;
};

export type OtpRecord = {
  phone: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  purpose: "login" | "elder_confirm" | "succession_confirm";
  meta?: Record<string, unknown>;
};

export type ExecutionTrustee = {
  fullName: string;
  phone: string;
  idNumber: string;
};

/**
 * A guardian is a second, independent confirmation layer on top of trustees.
 * Trustees start the claim; guardians (typically the two most senior
 * beneficiaries) must separately confirm before ops will look at the case.
 */
export type ExecutionGuardian = {
  fullName: string;
  phone: string;
  idNumber: string;
  relationship: string;
};

export type ExecutionPlan = {
  id: string;
  vaultId: string;
  triggerType: "upon_death";
  trustees: ExecutionTrustee[];
  minTrusteeApprovals: number;
  guardians: ExecutionGuardian[];
  /** Distinct guardians who must confirm; the dual-guardian rule defaults to 2 */
  minGuardianApprovals: number;
  requireDeathCertificate: boolean;
  /** Chief's / hospital death notification form, separate from the certificate */
  requireDeathNotification: boolean;
  coolingHours: number;
  updatedAt: string;
  updatedByUserId: string;
};

export type SuccessionCaseStatus =
  | "succession_filed"
  | "awaiting_trustee_otps"
  | "awaiting_guardian_confirmations"
  | "pending_ops_verification"
  | "succession_verified"
  | "with_advocate"
  | "succession_completed"
  | "succession_rejected";

export type SuccessionCase = {
  id: string;
  vaultId: string;
  filedByUserId: string;
  status: SuccessionCaseStatus;
  deathDate: string;
  deathCertificateName: string | null;
  deathCertificatePath: string | null;
  deathNotificationName: string | null;
  deathNotificationPath: string | null;
  filerNotes: string;
  opsReviewedByUserId: string | null;
  opsDecisionAt: string | null;
  opsNotes: string;
  advocateId: string | null;
  coolingEndsAt: string | null;
  /** Set when ops release the sealed vault to the appointed executors */
  vaultReleasedAt: string | null;
  vaultReleasedByUserId: string | null;
  releaseNotes: string;
  createdAt: string;
  updatedAt: string;
};

export type SuccessionApprovalRole = "trustee" | "guardian";

export type SuccessionApproval = {
  id: string;
  caseId: string;
  role: SuccessionApprovalRole;
  trusteePhone: string;
  trusteeName: string;
  status: "pending" | "approved" | "rejected";
  approvedAt: string | null;
  userId: string | null;
};

export type AuditEntry = {
  id: string;
  vaultId: string;
  actorUserId: string;
  action: string;
  detail: string;
  createdAt: string;
};

export type AdvocateApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "needs_info";

export type AdvocateApplication = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  lskNumber: string;
  /** Required document paths on disk */
  idFrontName: string;
  idFrontPath: string;
  idBackName: string;
  idBackPath: string;
  lskCertName: string;
  lskCertPath: string;
  /** Optional */
  officeAddress: string;
  lawFirm: string;
  organization: string;
  status: AdvocateApplicationStatus;
  adminNotes: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  createdUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdvocateMatchStatus = "offered" | "claimed" | "expired";

/**
 * An automated routing offer created when an elder submits for review. Every
 * advocate covering one of the estate's counties is offered the case; the first
 * to claim wins and the rest are expired.
 */
export type AdvocateMatch = {
  id: string;
  reviewRequestId: string;
  vaultId: string;
  advocateId: string;
  /** Counties both the estate and the advocate cover */
  matchedCounties: string[];
  /** Higher is a better fit; see lib/advocate/matching.ts */
  score: number;
  reason: string;
  status: AdvocateMatchStatus;
  createdAt: string;
  resolvedAt: string | null;
};

export type Database = {
  users: User[];
  vaults: Vault[];
  assets: Asset[];
  audioTestaments: AudioTestament[];
  advocateMatches: AdvocateMatch[];
  beneficiaries: Beneficiary[];
  allocations: Allocation[];
  agentLinks: AgentLink[];
  pendingChanges: PendingChange[];
  reviewRequests: ReviewRequest[];
  legalDocuments: LegalDocument[];
  titleLookups: TitleLookupRecord[];
  executionPlans: ExecutionPlan[];
  successionCases: SuccessionCase[];
  successionApprovals: SuccessionApproval[];
  advocateApplications: AdvocateApplication[];
  billingRecords: BillingRecord[];
  supportSessions: SupportSession[];
  caseMessages: CaseMessage[];
  consultBookings: ConsultBooking[];
  marketingLeads: MarketingLead[];
  publicStatusTokens: PublicStatusToken[];
  vaultBinders: VaultBinder[];
  otps: OtpRecord[];
  auditLog: AuditEntry[];
  dsarRequests: DsarRequest[];
  outboundNotices: OutboundNotice[];
};
