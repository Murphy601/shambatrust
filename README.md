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

### Key routes

| Route | Purpose |
|-------|---------|
| `/` | Landing |
| `/faq` `/terms` `/privacy` | Legal pages |
| `/login` | Phone OTP (elder / agent / advocate) |
| `/vault` | Elder / agent dashboard |
| `/vault/execution` | Death-trigger rules + trustees |
| `/vault/succession` | File / track death claim |
| `/advocate/queue` | Legacy review queue |
| `/advocate/succession` | Succession queue |
| `/ops/login` | Internal ops login |
| `/ops` | Ops overview |
| `/ops/succession` | Death-claim verification queue |

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

1. Elder: assets → heirs → review → advocate seals vault  
2. Elder: `/vault/execution` — add 2 trustees (their phones)  
3. Trustee/heir: sign in with trustee phone → `/vault/succession` → upload death certificate  
4. Each trustee: Approve via OTP on the same page  
5. Ops: `/ops/succession` → open case → Verify  
6. Wait cooling (or set 0 hours) → Advocate: `/advocate/succession` → claim → complete  

## Notes

- The platform never “detects” death; claims are filed with proofs and verified by ops.
- View-only previews reduce casual downloads; screenshots remain possible.

## Supabase (optional)

SQL schema at `supabase/schema.sql`. Local app still uses `.data/db.json`.
