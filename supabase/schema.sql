-- ShambaTrust Phase 2+3 schema (PostgreSQL / Supabase)
-- Local app currently uses .data/db.json; migrate here when ready.

create extension if not exists "pgcrypto";

create type user_role as enum ('elder', 'agent', 'advocate');
create type asset_type as enum (
  'land', 'commercial_plot', 'business', 'vehicle', 'bank_account', 'sacco', 'other'
);
create type vault_status as enum ('draft', 'pending_review', 'in_review', 'sealed');
create type package_tier as enum ('vault', 'standard', 'premium');
create type legal_doc_type as enum ('will', 'land_trust', 'poa');
create type legal_doc_status as enum ('draft', 'ready_for_sign', 'signed', 'certified');
create type transcript_status as enum (
  'pending', 'in_progress', 'transcribed', 'rejected'
);
create type succession_status as enum (
  'succession_filed',
  'awaiting_trustee_otps',
  'awaiting_guardian_confirmations',
  'pending_ops_verification',
  'succession_verified',
  'with_advocate',
  'succession_completed',
  'succession_rejected'
);
create type succession_approval_role as enum ('trustee', 'guardian');
create type advocate_match_status as enum ('offered', 'claimed', 'expired');

create table profiles (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  full_name text not null,
  role user_role not null default 'elder',
  locale text not null default 'en',
  -- Mother tongue for audio-guided forms and voice testaments; independent of
  -- `locale`, which only drives the translated UI chrome.
  preferred_language text not null default 'en',
  audio_guidance boolean not null default false,
  advocate_license text,
  -- Counties an advocate practises in; drives automated case routing.
  advocate_counties text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table vaults (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  status vault_status not null default 'draft',
  package_tier package_tier,
  binder_requested boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table assets (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references vaults(id) on delete cascade,
  type asset_type not null,
  title text not null,
  notes text,
  document_path text,
  title_number text,
  county text,
  sub_county text,
  landmark text,
  gps_lat double precision,
  gps_lng double precision,
  -- ArdhiSasa parcel search identifiers
  parcel_number text,
  block_number text,
  registration_section text,
  land_registry_office text,
  registration_number text,
  make_model text,
  year text,
  bank_name text,
  account_number text,
  account_type text,
  business_reg_number text,
  kra_pin text,
  -- SACCO / mobile money
  sacco_name text,
  sacco_member_number text,
  mpesa_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- SACCO bylaws pay nominees directly, outside the estate, so these shares are
-- kept separate from `allocations` and are expected to total 100 per account.
create table sacco_nominees (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  full_name text not null,
  id_number text,
  phone text,
  relationship text,
  percentage numeric(5,2) not null check (percentage >= 0 and percentage <= 100),
  created_at timestamptz not null default now()
);

create table beneficiaries (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references vaults(id) on delete cascade,
  full_name text not null,
  id_number text,
  phone text,
  relationship text not null,
  created_at timestamptz not null default now()
);

create table allocations (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references vaults(id) on delete cascade,
  beneficiary_id uuid not null references beneficiaries(id) on delete cascade,
  asset_id uuid references assets(id) on delete set null,
  percentage numeric(5,2),
  specific_gift text,
  created_at timestamptz not null default now()
);

create table agent_links (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references vaults(id) on delete cascade,
  elder_user_id uuid not null references profiles(id) on delete cascade,
  agent_user_id uuid references profiles(id),
  agent_phone text not null,
  status text not null check (status in ('pending', 'active', 'revoked')),
  created_at timestamptz not null default now()
);

create table review_requests (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references vaults(id) on delete cascade,
  package_tier package_tier not null,
  consult_mode text not null,
  notes text,
  status text not null default 'submitted',
  advocate_id uuid references profiles(id),
  assigned_at timestamptz,
  completed_at timestamptz,
  consult_scheduled_at timestamptz,
  consult_notes text,
  checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table legal_documents (
  id uuid primary key default gen_random_uuid(),
  review_request_id uuid not null references review_requests(id) on delete cascade,
  vault_id uuid not null references vaults(id) on delete cascade,
  type legal_doc_type not null,
  status legal_doc_status not null default 'draft',
  title text not null,
  body text,
  document_name text,
  document_path text,
  signature_name text,
  signed_at timestamptz,
  signed_by_user_id uuid references profiles(id),
  -- Advocate legal stamp, applied before the e-signature
  stamp_ref text unique,
  stamped_at timestamptz,
  stamped_by_user_id uuid references profiles(id),
  stamp_advocate_name text,
  stamp_lsk_number text,
  stamp_county text,
  stamp_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table title_lookups (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references vaults(id) on delete cascade,
  asset_id uuid references assets(id) on delete set null,
  title_number text not null,
  county text,
  result jsonb not null,
  requested_by_user_id uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

-- Spoken instructions recorded by (or for) an elder in their own language.
-- Evidence of intent that supports the written dossier; never a substitute for
-- the advocate-drafted will.
create table audio_testaments (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references vaults(id) on delete cascade,
  asset_id uuid references assets(id) on delete set null,
  recorded_by_user_id uuid not null references profiles(id),
  recorded_by_agent boolean not null default false,
  title text not null,
  language text not null default 'en',
  document_name text not null,
  document_path text not null,
  mime_type text not null,
  file_size bigint not null,
  duration_seconds integer,
  transcript text not null default '',
  transcript_status transcript_status not null default 'pending',
  transcribed_by_user_id uuid references profiles(id),
  transcribed_at timestamptz,
  transcript_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Automated routing offers created when an elder submits for review. Every
-- advocate covering one of the estate's counties is offered the case; the first
-- to claim wins and the rest are expired.
create table advocate_matches (
  id uuid primary key default gen_random_uuid(),
  review_request_id uuid not null references review_requests(id) on delete cascade,
  vault_id uuid not null references vaults(id) on delete cascade,
  advocate_id uuid not null references profiles(id) on delete cascade,
  matched_counties text[] not null default '{}',
  score integer not null default 0,
  reason text,
  status advocate_match_status not null default 'offered',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (review_request_id, advocate_id)
);

-- Dead Man's Switch configuration: who can start succession, who must confirm
-- it, and which proofs of death are mandatory.
create table execution_plans (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null unique references vaults(id) on delete cascade,
  trigger_type text not null default 'upon_death',
  trustees jsonb not null default '[]'::jsonb,
  min_trustee_approvals integer not null default 2,
  guardians jsonb not null default '[]'::jsonb,
  min_guardian_approvals integer not null default 2,
  require_death_certificate boolean not null default true,
  require_death_notification boolean not null default true,
  cooling_hours integer not null default 48,
  updated_by_user_id uuid references profiles(id),
  updated_at timestamptz not null default now()
);

create table succession_cases (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references vaults(id) on delete cascade,
  filed_by_user_id uuid not null references profiles(id),
  status succession_status not null default 'succession_filed',
  death_date date not null,
  death_certificate_name text,
  death_certificate_path text,
  death_notification_name text,
  death_notification_path text,
  filer_notes text,
  ops_reviewed_by_user_id uuid references profiles(id),
  ops_decision_at timestamptz,
  ops_notes text,
  advocate_id uuid references profiles(id),
  cooling_ends_at timestamptz,
  -- Final gate: sealed vault handed to the appointed executors.
  vault_released_at timestamptz,
  vault_released_by_user_id uuid references profiles(id),
  release_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trustees approve first, then two different guardians must separately confirm.
-- The partial unique index stops one account from filling both guardian slots.
create table succession_approvals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references succession_cases(id) on delete cascade,
  role succession_approval_role not null default 'trustee',
  trustee_phone text not null,
  trustee_name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_at timestamptz,
  user_id uuid references profiles(id),
  unique (case_id, role, trustee_phone)
);

create unique index succession_approvals_one_per_user_per_role
  on succession_approvals (case_id, role, user_id)
  where status = 'approved' and user_id is not null;

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references vaults(id) on delete cascade,
  actor_user_id uuid not null references profiles(id),
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

-- Enable RLS in Supabase and add owner/agent/advocate policies before production use.
