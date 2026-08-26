# ShambaTrust

Kenyan ancestral asset digitization & estate succession vault.

## Phase 1 — Marketing

- Landing page (EN / Kiswahili)
- Family Peace Audit
- WhatsApp lead capture

## Phase 2 — Core vault app

- Phone OTP login (dev mode shows the code on screen)
- Elder vault dashboard
- Asset catalog wizard + title deed upload
- Heirs + percentage / plot allocations
- Agent Mode (family helper invite; heir changes blocked for agents)
- Legal review request → WhatsApp handoff + binder flag
- Local data in `.data/` (Supabase schema ready for later)

## Phase 3 — Advocate portal & integrations

- Advocate role on login (LSK optional licence field)
- Advocate queue: claim cases submitted by elders
- Case workspace: brief, verification checklist, consultation schedule
- Legal document drafts (Will / Land Trust / POA)
- Simulated e-sign + optional certified PDF upload → vault seal
- Simulated ArdhiSasa / land registry title lookup
- Elder vault shows certified documents after seal

## Phase 4 — Security controls + Ops desk

- Least privilege for assigned advocates
- View-only document preview (canvas; no download)
- Elder consent + advocate SLA
- Ops desk at `/ops` (not public nav)

## Phase 5 — Succession trigger

- Elder **Execution** plan: named trustees, OTP approvals required, death-cert rule, cooling hours
- **Succession claim** by trustee / heir / agent on a sealed vault + death certificate upload
- Trustee OTP confirmations
- **Ops verification** queue (`/ops/succession`) — approve / reject
- **Advocate succession** queue after cooling — claim case, complete probate handoff
- Automatic audit events for the company

## Phase 6 — Kenyan-market depth

### Homepage carousels

- **Success stories** — auto-rotating, county-tagged testimonial carousel
- **Onboarding journey** — interactive 4-step slider (inventory → will/trust → LSK verification → secured vault)

Both are CSS scroll-snap tracks, so touch, trackpad, keyboard and
`prefers-reduced-motion` all behave without a carousel dependency.

### Specialised data fields

- **ArdhiSasa parcel search** — parcel number, block number, registration section, county land registry office alongside the LR/title number
- **SACCO / M-Pesa** — a `sacco` asset type with SACCO name, member ID, linked M-Pesa number, and nominee percentages that must total 100% (SACCO bylaws pay nominees outside the estate)
- **Language preference** — mother tongue for audio-guided forms, separate from the English/Kiswahili UI toggle

### Voice testaments

Elders (or a family agent) record spoken instructions in Kikuyu, Dholuo,
Kalenjin, Kamba, Luhya, Kisii, Maasai, Somali, Meru, Kiswahili or English —
through the browser microphone or by uploading audio from a phone. Playback runs
through an access-controlled, audited endpoint. Ops transcribe from
`/ops/transcripts`, and the transcript travels with the dossier into the
advocate case view and the sealed binder.

### Succession activation (Dead Man's Switch)

The claim now runs in explicit stages, and **no single person can open a vault**:

1. Claim filed with the official **death notification** and/or **death certificate** (the elder chooses which are mandatory)
2. **Trustees** approve by OTP
3. **Two different guardians** separately confirm — the same account cannot fill both slots
4. **Ops** verify the claim
5. **Cooling period** elapses
6. **Ops release** vault access to the executors

Release rules are evaluated server-side and returned as gates, so the ops desk
shows exactly what is still blocking. Confirmed trustees, confirmed guardians and
named heirs then read the released dossier at `/vault/released`.

### Advocate portal

- **Automated county matching** — on submit, the dossier is offered to every practising advocate covering the estate's counties, ranked by coverage and caseload. First to claim wins; the other offers expire.
- **Legal stamps** — an advocate stamps an instrument with their LSK practising number and a unique reference before e-signing. Signing is blocked until the stamp exists.
- Advocates declare their counties, capacity, and out-of-office window at `/advocate/profile`; out-of-office advocates are skipped by routing.

### Key routes

| Route | Purpose |
|-------|---------|
| `/` | Landing (carousels, audit, pricing) |
| `/faq` `/terms` `/privacy` | Legal pages |
| `/login` | Phone OTP (elder / agent / advocate) |
| `/vault` | Elder / agent dashboard |
| `/vault/testament` | Voice testament recorder + language preference |
| `/vault/execution` | Death-trigger rules, trustees, guardians |
| `/vault/succession` | File / track death claim |
| `/vault/released` | Executor view of a released vault |
| `/advocate/queue` | Review queue (matched + open) |
| `/advocate/profile` | County coverage & availability |
| `/advocate/succession` | Succession queue |
| `/ops/login` | Internal ops login |
| `/ops` | Ops overview |
| `/ops/succession` | Death-claim verification + vault release |
| `/ops/transcripts` | Voice testament transcription queue |

## Setup

```bash
npm install
cp .env.example .env.local
```

```
NEXT_PUBLIC_WHATSAPP_NUMBER=254748879579
AUTH_DEV_MODE=true
AUTH_SECRET=your-long-random-secret
OPS_ADMIN_PHONES=254748879579
```

## Develop

```bash
npm run dev -- --port 3001
```

### Succession demo path

1. Elder: assets → heirs → review → advocate stamps, signs, and seals the vault
2. Elder: `/vault/execution` — add 2 trustees and 2 guardians (their phones), set cooling to 0 hours
3. Trustee/heir: sign in with a trustee phone → `/vault/succession` → upload the death notification and certificate
4. Each trustee: Approve via OTP on the same page
5. Each guardian: sign in with their own phone → Confirm via OTP (two different accounts required)
6. Ops: `/ops/succession` → open case → Verify
7. Ops: same page → Release vault access
8. Executor: `/vault/released` — read the sealed dossier
9. Advocate: `/advocate/succession` → claim → complete the probate handoff

## Notes

- The platform never “detects” death; claims are filed with proofs and verified by ops.
- View-only previews reduce casual downloads; screenshots remain possible.
- Voice recordings support the written will; they never replace the advocate-drafted instrument.
- Browser recording needs a secure context. On `http://` origins other than
  `localhost`, `MediaRecorder` is unavailable and the page falls back to file upload.

## Supabase (optional)

SQL schema at `supabase/schema.sql`. Local app still uses `.data/db.json`.
