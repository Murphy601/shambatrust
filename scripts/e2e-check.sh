#!/usr/bin/env bash
# End-to-end smoke check for the Phase 6 workflows.
#
# Exercises the real HTTP surface against a dev server (AUTH_DEV_MODE=true so
# OTP codes come back in the response). Not a substitute for a test framework —
# this is a scripted walk-through of the happy paths plus the guard rails that
# must reject.
#
#   npm run dev -- --port 3001
#   ./scripts/e2e-check.sh
set -uo pipefail

BASE="${BASE:-http://localhost:3001}"
TMP="$(mktemp -d)"
PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); printf '  \033[32mPASS\033[0m %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf '  \033[31mFAIL\033[0m %s\n' "$1"; [ $# -gt 1 ] && printf '       %s\n' "$2"; }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# check <label> <condition-result> [detail]
check() { if [ "$2" = "true" ]; then pass "$1"; else fail "$1" "${3:-}"; fi; }

jar() { echo "$TMP/$1.cookies"; }

api() { # api <user> <method> <path> [json]
  local user="$1" method="$2" path="$3" body="${4:-}"
  if [ -n "$body" ]; then
    curl -s -b "$(jar "$user")" -c "$(jar "$user")" -X "$method" \
      -H 'Content-Type: application/json' -d "$body" "$BASE$path"
  else
    curl -s -b "$(jar "$user")" -c "$(jar "$user")" -X "$method" "$BASE$path"
  fi
}

status() { # status <user> <method> <path> [json]
  local user="$1" method="$2" path="$3" body="${4:-}"
  if [ -n "$body" ]; then
    curl -s -o /dev/null -w '%{http_code}' -b "$(jar "$user")" -c "$(jar "$user")" \
      -X "$method" -H 'Content-Type: application/json' -d "$body" "$BASE$path"
  else
    curl -s -o /dev/null -w '%{http_code}' -b "$(jar "$user")" -c "$(jar "$user")" \
      -X "$method" "$BASE$path"
  fi
}

# Unique phone suffix so repeat runs do not collide on existing accounts.
# Kenyan numbers normalize to 2547XXXXXXXX — twelve digits exactly.
RUN="$(date +%H%M%S)"
p() { echo "2547${RUN}0$1"; }

OPS_PHONE="254700000001"
ELDER_PHONE="$(p 1)"
ADV_PHONE="$(p 2)"
T1_PHONE="$(p 3)"
T2_PHONE="$(p 4)"
G1_PHONE="$(p 5)"
G2_PHONE="$(p 6)"
LSK="LSK/ADV/${RUN}"

otp() { # otp <phone> [mode]
  local phone="$1" mode="${2:-}"
  local body
  if [ -n "$mode" ]; then
    body="{\"phone\":\"$phone\",\"mode\":\"$mode\"}"
  else
    body="{\"phone\":\"$phone\"}"
  fi
  curl -s -X POST -H 'Content-Type: application/json' -d "$body" \
    "$BASE/api/auth/request-otp" | jq -r '.devCode // empty'
}

upload_id() { # upload_id <slot> -> documentPath
  printf 'fake-id-scan' > "$TMP/id.png"
  curl -s -X POST -F "file=@$TMP/id.png;type=image/png" -F "slot=$1" \
    "$BASE/api/auth/signup/upload" | jq -r '.documentPath'
}

signup_agent() { # signup_agent <user-key> <phone> <name>
  local code
  code="$(otp "$2" signup)"
  api "$1" POST /api/auth/verify-otp "$(jq -nc \
    --arg phone "$2" --arg code "$code" --arg name "$3" \
    '{mode:"signup",phone:$phone,code:$code,fullName:$name,role:"agent",address:"Test address",county:"Nakuru"}')"
}

printf '\033[1mShambaTrust end-to-end check\033[0m  (%s)\n' "$BASE"

# ---------------------------------------------------------------- ops sign-in
step "1. Ops desk sign-in"
OPS_CODE="$(otp "$OPS_PHONE")"
OPS_LOGIN="$(api ops POST /api/ops/auth/verify \
  "{\"phone\":\"$OPS_PHONE\",\"code\":\"$OPS_CODE\",\"fullName\":\"Ops Desk\"}")"
check "ops session created" \
  "$([ "$(echo "$OPS_LOGIN" | jq -r '.ok // false')" = "true" ] && echo true || echo false)" \
  "$OPS_LOGIN"

# ------------------------------------------------------------- advocate setup
step "2. Advocate application, approval, and county coverage"
ADV_ID_FRONT="$(upload_id adv-front)"
ADV_ID_BACK="$(upload_id adv-back)"
ADV_CERT="$(upload_id adv-cert)"
APPLY="$(curl -s -X POST -H 'Content-Type: application/json' -d "$(jq -nc \
  --arg phone "$ADV_PHONE" --arg lsk "$LSK" \
  --arg f "$ADV_ID_FRONT" --arg b "$ADV_ID_BACK" --arg c "$ADV_CERT" \
  --arg email "adv${RUN}@example.com" \
  '{fullName:"Counsel Wanjala",phone:$phone,email:$email,lskNumber:$lsk,
    idFrontName:"front.png",idFrontPath:$f,idBackName:"back.png",idBackPath:$b,
    lskCertName:"cert.png",lskCertPath:$c,officeAddress:"Nakuru CBD"}')" \
  "$BASE/api/advocates/apply")"
APP_ID="$(echo "$APPLY" | jq -r '.application.id // empty')"
check "advocate application created" "$([ -n "$APP_ID" ] && echo true || echo false)" "$APPLY"

APPROVE="$(api ops POST /api/ops/advocate-applications \
  "{\"applicationId\":\"$APP_ID\",\"decision\":\"approved\",\"adminNotes\":\"verified\"}")"
check "ops approved advocate" \
  "$([ "$(echo "$APPROVE" | jq -r '.application.status')" = "approved" ] && echo true || echo false)" \
  "$APPROVE"

ADV_CODE="$(otp "$ADV_PHONE")"
ADV_LOGIN="$(api adv POST /api/advocate/auth/verify \
  "{\"phone\":\"$ADV_PHONE\",\"code\":\"$ADV_CODE\",\"lskNumber\":\"$LSK\"}")"
check "advocate portal sign-in" \
  "$([ "$(echo "$ADV_LOGIN" | jq -r '.ok // false')" = "true" ] && echo true || echo false)" \
  "$ADV_LOGIN"

COUNTIES="$(api adv PATCH /api/advocate/profile \
  '{"advocateCounties":["Nakuru","Kiambu"],"advocateMaxCases":10}')"
check "advocate declared county coverage" \
  "$([ "$(echo "$COUNTIES" | jq -r '.profile.advocateCounties | join(",")')" = "Nakuru,Kiambu" ] && echo true || echo false)" \
  "$COUNTIES"

BAD_COUNTY="$(status adv PATCH /api/advocate/profile '{"advocateCounties":["Atlantis"]}')"
check "invalid county rejected (400)" \
  "$([ "$BAD_COUNTY" = "400" ] && echo true || echo false)" "got $BAD_COUNTY"

# ---------------------------------------------------------------- elder setup
step "3. Elder signup"
E_FRONT="$(upload_id elder-front)"
E_BACK="$(upload_id elder-back)"
E_CODE="$(otp "$ELDER_PHONE" signup)"
ELDER="$(api elder POST /api/auth/verify-otp "$(jq -nc \
  --arg phone "$ELDER_PHONE" --arg code "$E_CODE" --arg f "$E_FRONT" --arg b "$E_BACK" \
  '{mode:"signup",phone:$phone,code:$code,fullName:"Mzee Kamau",role:"elder",
    address:"Bahati, Nakuru",county:"Nakuru",
    idFrontName:"f.png",idFrontPath:$f,idBackName:"b.png",idBackPath:$b}')")"
check "elder account + vault created" \
  "$([ "$(echo "$ELDER" | jq -r '.ok // false')" = "true" ] && echo true || echo false)" \
  "$ELDER"

# ------------------------------------------------------- ArdhiSasa/SACCO fields
step "4. ArdhiSasa parcel fields and SACCO nominees"
LAND="$(api elder POST /api/vault/assets '{
  "type":"land","title":"Bahati family shamba","county":"Nakuru","subCounty":"Bahati",
  "titleNumber":"NKU/BAHATI/1234","parcelNumber":"1234","blockNumber":"Block 12",
  "registrationSection":"Bahati","landRegistryOffice":"Nakuru",
  "gpsLat":-0.1791,"gpsLng":36.0665}')"
check "land asset stores ArdhiSasa parcel + block" \
  "$([ "$(echo "$LAND" | jq -r '.asset.blockNumber')" = "Block 12" ] && \
     [ "$(echo "$LAND" | jq -r '.asset.parcelNumber')" = "1234" ] && \
     [ "$(echo "$LAND" | jq -r '.asset.landRegistryOffice')" = "Nakuru" ] && echo true || echo false)" \
  "$LAND"
LAND_ID="$(echo "$LAND" | jq -r '.asset.id')"

BAD_SACCO="$(api elder POST /api/vault/assets '{
  "type":"sacco","title":"Stima SACCO","saccoName":"Stima SACCO","saccoMemberNumber":"SM-77",
  "saccoNominees":[{"fullName":"Njeri Kamau","percentage":40,"idNumber":"","phone":"","relationship":"Daughter"}]}')"
check "SACCO nominees not totalling 100% rejected" \
  "$(echo "$BAD_SACCO" | jq -r 'if (.error // "") | test("100%") then "true" else "false" end')" \
  "$BAD_SACCO"

SACCO="$(api elder POST /api/vault/assets "$(jq -nc --arg g1 "$G1_PHONE" --arg g2 "$G2_PHONE" '{
  type:"sacco",title:"Stima SACCO deposits",saccoName:"Stima SACCO",
  saccoMemberNumber:"SM-77",mpesaNumber:"254712000000",
  saccoNominees:[
    {fullName:"Njeri Kamau",percentage:60,idNumber:"111",phone:$g1,relationship:"Daughter"},
    {fullName:"Otieno Kamau",percentage:40,idNumber:"222",phone:$g2,relationship:"Son"}]}')")"
check "SACCO asset saved with nominee split" \
  "$([ "$(echo "$SACCO" | jq -r '.asset.saccoNominees | map(.percentage) | add')" = "100" ] && \
     [ "$(echo "$SACCO" | jq -r '.asset.saccoNominees | length')" = "2" ] && echo true || echo false)" \
  "$SACCO"
check "nominees given stable ids" \
  "$(echo "$SACCO" | jq -r 'if (.asset.saccoNominees[0].id | length) > 0 then "true" else "false" end')" \
  "$SACCO"

# ------------------------------------------------------------ voice testament
step "5. Voice testament and language preference"
PREFS="$(api elder PATCH /api/vault/preferences '{"preferredLanguage":"ki","audioGuidance":true}')"
check "mother-tongue preference saved (Kikuyu)" \
  "$([ "$(echo "$PREFS" | jq -r '.preferences.preferredLanguage')" = "ki" ] && echo true || echo false)" \
  "$PREFS"

BAD_PREF="$(status elder PATCH /api/vault/preferences '{"preferredLanguage":"klingon"}')"
check "unknown language rejected (400)" \
  "$([ "$BAD_PREF" = "400" ] && echo true || echo false)" "got $BAD_PREF"

printf 'fake-opus-audio-bytes' > "$TMP/testament.webm"
TESTAMENT="$(curl -s -b "$(jar elder)" -c "$(jar elder)" -X POST \
  -F "file=@$TMP/testament.webm;type=audio/webm" \
  -F 'title=My wishes for the Bahati shamba' -F 'language=ki' \
  -F "assetId=$LAND_ID" -F 'durationSeconds=94' \
  "$BASE/api/vault/testaments")"
TESTAMENT_ID="$(echo "$TESTAMENT" | jq -r '.testament.id // empty')"
check "voice testament stored in Kikuyu" \
  "$([ -n "$TESTAMENT_ID" ] && [ "$(echo "$TESTAMENT" | jq -r '.testament.language')" = "ki" ] && echo true || echo false)" \
  "$TESTAMENT"

printf 'not audio' > "$TMP/bad.txt"
BAD_AUDIO="$(curl -s -o /dev/null -w '%{http_code}' -b "$(jar elder)" -X POST \
  -F "file=@$TMP/bad.txt;type=text/plain" -F 'title=x' -F 'language=en' \
  "$BASE/api/vault/testaments")"
check "non-audio upload rejected (400)" \
  "$([ "$BAD_AUDIO" = "400" ] && echo true || echo false)" "got $BAD_AUDIO"

AUDIO_OK="$(status elder GET "/api/vault/testaments/$TESTAMENT_ID/audio")"
check "owner can stream their recording (200)" \
  "$([ "$AUDIO_OK" = "200" ] && echo true || echo false)" "got $AUDIO_OK"

AUDIO_ANON="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/vault/testaments/$TESTAMENT_ID/audio")"
check "anonymous playback blocked (401)" \
  "$([ "$AUDIO_ANON" = "401" ] && echo true || echo false)" "got $AUDIO_ANON"

# ------------------------------------------------------- heirs and allocations
step "6. Heirs, allocations, execution plan"
H1="$(api elder POST /api/vault/beneficiaries "$(jq -nc --arg p "$G1_PHONE" \
  '{fullName:"Njeri Kamau",idNumber:"111",phone:$p,relationship:"Daughter"}')")"
H2="$(api elder POST /api/vault/beneficiaries "$(jq -nc --arg p "$G2_PHONE" \
  '{fullName:"Otieno Kamau",idNumber:"222",phone:$p,relationship:"Son"}')")"
H1_ID="$(echo "$H1" | jq -r '.beneficiary.id // .id // empty')"
H2_ID="$(echo "$H2" | jq -r '.beneficiary.id // .id // empty')"
check "two heirs recorded" \
  "$([ -n "$H1_ID" ] && [ -n "$H2_ID" ] && echo true || echo false)" "$H1 / $H2"

ALLOC="$(api elder PUT /api/vault/allocations "$(jq -nc --arg h1 "$H1_ID" --arg h2 "$H2_ID" --arg a "$LAND_ID" \
  '{allocations:[{beneficiaryId:$h1,assetId:$a,percentage:60,specificGift:""},
                 {beneficiaryId:$h2,assetId:$a,percentage:40,specificGift:""}]}')")"
check "allocations saved" \
  "$([ "$(echo "$ALLOC" | jq -r '.allocations | length')" = "2" ] && echo true || echo false)" "$ALLOC"

PLAN_ONE_GUARDIAN="$(status elder PUT /api/vault/execution "$(jq -nc --arg t1 "$T1_PHONE" --arg g1 "$G1_PHONE" \
  '{trustees:[{fullName:"Trustee One",phone:$t1,idNumber:"1"}],minTrusteeApprovals:1,
    guardians:[{fullName:"Njeri Kamau",phone:$g1,idNumber:"111",relationship:"Daughter"}],
    minGuardianApprovals:1,requireDeathCertificate:true,requireDeathNotification:true,coolingHours:0}')")"
check "single-guardian rule rejected (400)" \
  "$([ "$PLAN_ONE_GUARDIAN" = "400" ] && echo true || echo false)" "got $PLAN_ONE_GUARDIAN"

PLAN="$(api elder PUT /api/vault/execution "$(jq -nc \
  --arg t1 "$T1_PHONE" --arg t2 "$T2_PHONE" --arg g1 "$G1_PHONE" --arg g2 "$G2_PHONE" \
  '{trustees:[{fullName:"Trustee One",phone:$t1,idNumber:"1"},
              {fullName:"Trustee Two",phone:$t2,idNumber:"2"}],
    minTrusteeApprovals:2,
    guardians:[{fullName:"Njeri Kamau",phone:$g1,idNumber:"111",relationship:"Daughter"},
               {fullName:"Otieno Kamau",phone:$g2,idNumber:"222",relationship:"Son"}],
    minGuardianApprovals:2,requireDeathCertificate:true,requireDeathNotification:true,coolingHours:0}')")"
check "execution plan saved with 2 trustees + 2 guardians" \
  "$([ "$(echo "$PLAN" | jq -r '.plan.guardians | length')" = "2" ] && \
     [ "$(echo "$PLAN" | jq -r '.plan.minGuardianApprovals')" = "2" ] && echo true || echo false)" \
  "$PLAN"

# ----------------------------------------------------- review + county routing
step "7. Review submission and automated advocate matching"
REVIEW="$(api elder POST /api/vault/review \
  '{"packageTier":"standard","consultMode":"whatsapp","notes":"Two heirs, one shamba.","consentAccepted":true}')"
REVIEW_ID="$(echo "$REVIEW" | jq -r '.review.id // empty')"
check "review submitted" "$([ -n "$REVIEW_ID" ] && echo true || echo false)" "$REVIEW"

QUEUE="$(api adv GET '/api/advocate/reviews?matched=true')"
check "case auto-routed to the Nakuru advocate" \
  "$(echo "$QUEUE" | jq -r --arg id "$REVIEW_ID" \
     'if any(.reviews[]; .id == $id and .matched) then "true" else "false" end')" \
  "$QUEUE"
check "match reason cites county coverage" \
  "$(echo "$QUEUE" | jq -r --arg id "$REVIEW_ID" \
     'if any(.reviews[]; .id == $id and (.matchReason // "" | test("Nakuru"))) then "true" else "false" end')" \
  "$QUEUE"

# ------------------------------------------------------------- transcription
# Ops transcribe before the advocate seals, so the transcript is in front of
# counsel while they draft and ends up inside the immutable binder.
step "8. Ops transcription desk"
QUEUE_T="$(api ops GET /api/ops/transcripts)"
check "recording appears in the transcription queue" \
  "$(echo "$QUEUE_T" | jq -r --arg id "$TESTAMENT_ID" \
     'if any(.testaments[]; .id == $id) then "true" else "false" end')" \
  "$(echo "$QUEUE_T" | jq -c '[.testaments[].id]')"
check "queue never leaks the stored file path" \
  "$(echo "$QUEUE_T" | jq -r 'if all(.testaments[]; .documentPath == null) then "true" else "false" end')" \
  "$QUEUE_T"

SHORT="$(api ops PATCH /api/ops/transcripts \
  "{\"testamentId\":\"$TESTAMENT_ID\",\"transcript\":\"eh\",\"transcriptStatus\":\"transcribed\"}")"
check "empty transcript cannot be marked complete" \
  "$(echo "$SHORT" | jq -r 'if (.error // "") | length > 0 then "true" else "false" end')" "$SHORT"

TRANSCRIPT_TEXT="Nĩngwenda gĩthaka kĩa Bahati kĩgayanwo: Njeri 60%, Otieno 40%."
TRANSCRIBED="$(api ops PATCH /api/ops/transcripts "$(jq -nc --arg id "$TESTAMENT_ID" --arg text "$TRANSCRIPT_TEXT" \
  '{testamentId:$id,transcriptStatus:"transcribed",transcript:$text,
    transcriptNotes:"Kikuyu, confirmed with the family."}')")"
check "transcript saved and marked complete" \
  "$([ "$(echo "$TRANSCRIBED" | jq -r '.testament.transcriptStatus')" = "transcribed" ] && echo true || echo false)" \
  "$TRANSCRIBED"

# ------------------------------------------------------- stamp and e-signature
step "9. Advocate stamp gate and e-signature"
api adv POST "/api/advocate/reviews/$REVIEW_ID/assign" '{"slaAccepted":true}' > /dev/null

CASE="$(api adv GET "/api/advocate/reviews/$REVIEW_ID")"
check "case brief exposes the voice testament" \
  "$([ "$(echo "$CASE" | jq -r '.testaments | length')" = "1" ] && echo true || echo false)" \
  "$(echo "$CASE" | jq -c '.testaments')"
check "case brief exposes SACCO nominee split" \
  "$(echo "$CASE" | jq -r 'if any(.assets[]; .type == "sacco" and (.saccoNominees | length) == 2) then "true" else "false" end')" \
  "$(echo "$CASE" | jq -c '[.assets[] | {type, saccoNominees}]')"
check "case brief exposes ArdhiSasa block number" \
  "$(echo "$CASE" | jq -r 'if any(.assets[]; .blockNumber == "Block 12") then "true" else "false" end')" \
  "$(echo "$CASE" | jq -c '[.assets[] | {title, blockNumber, parcelNumber}]')"

ADV_AUDIO="$(status adv GET "/api/vault/testaments/$TESTAMENT_ID/audio")"
check "assigned advocate can play the recording (200)" \
  "$([ "$ADV_AUDIO" = "200" ] && echo true || echo false)" "got $ADV_AUDIO"

CHECKLIST="$(echo "$CASE" | jq -c '[.review.checklist[] | .done = true]')"
api adv PATCH "/api/advocate/reviews/$REVIEW_ID" "{\"checklist\":$CHECKLIST}" > /dev/null

DOC="$(api adv POST "/api/advocate/reviews/$REVIEW_ID/documents" \
  '{"type":"will","title":"Last Will of Mzee Kamau","body":"Clause 1...","status":"ready_for_sign"}')"
DOC_ID="$(echo "$DOC" | jq -r '.document.id // empty')"
check "will draft created" "$([ -n "$DOC_ID" ] && echo true || echo false)" "$DOC"

UNSTAMPED_SIGN="$(api adv POST "/api/advocate/reviews/$REVIEW_ID/sign" \
  "{\"documentId\":\"$DOC_ID\",\"signatureName\":\"Counsel Wanjala\",\"sealCase\":false}")"
check "signing without a stamp is blocked" \
  "$(echo "$UNSTAMPED_SIGN" | jq -r 'if (.error // "") | test("stamp") then "true" else "false" end')" \
  "$UNSTAMPED_SIGN"

STAMP="$(api adv POST "/api/advocate/reviews/$REVIEW_ID/stamp" \
  "{\"documentId\":\"$DOC_ID\",\"county\":\"Nakuru\",\"notes\":\"Title verified against registry.\"}")"
STAMP_REF="$(echo "$STAMP" | jq -r '.document.stampRef // empty')"
check "legal stamp applied with LSK reference" \
  "$([ -n "$STAMP_REF" ] && [ "$(echo "$STAMP" | jq -r '.document.stampLskNumber')" != "" ] && echo true || echo false)" \
  "$STAMP"

SIGN="$(api adv POST "/api/advocate/reviews/$REVIEW_ID/sign" \
  "{\"documentId\":\"$DOC_ID\",\"signatureName\":\"Counsel Wanjala\",\"sealCase\":true}")"
check "stamped document signed and vault sealed" \
  "$([ "$(echo "$SIGN" | jq -r '.review.status')" = "completed" ] && echo true || echo false)" \
  "$SIGN"

BINDER="$(jq -r '[.vaultBinders[]] | last' .data/db.json 2>/dev/null)"
check "sealed binder PDF generated" \
  "$([ "$(echo "$BINDER" | jq -r '.status')" = "ready" ] && echo true || echo false)" \
  "$BINDER"

# ------------------------------------------------------- succession activation
step "10. Succession activation"
signup_agent t1 "$T1_PHONE" "Trustee One" > /dev/null
signup_agent t2 "$T2_PHONE" "Trustee Two" > /dev/null
signup_agent g1 "$G1_PHONE" "Njeri Kamau" > /dev/null
signup_agent g2 "$G2_PHONE" "Otieno Kamau" > /dev/null

VAULT_ID="$(api elder GET /api/vault/summary | jq -r '.vault.id // .vaultId // empty')"
check "vault id resolved for claim filing" \
  "$([ -n "$VAULT_ID" ] && echo true || echo false)" "$(api elder GET /api/vault/summary)"

printf 'fake-death-cert' > "$TMP/cert.pdf"
printf 'fake-death-notice' > "$TMP/notice.pdf"

NO_NOTICE="$(curl -s -b "$(jar t1)" -X POST \
  -F "vaultId=$VAULT_ID" -F 'deathDate=2026-08-01' \
  -F "file=@$TMP/cert.pdf;type=application/pdf" \
  "$BASE/api/succession/cases")"
check "claim without the death notification is rejected" \
  "$(echo "$NO_NOTICE" | jq -r 'if (.error // "") | test("notification") then "true" else "false" end')" \
  "$NO_NOTICE"

CLAIM="$(curl -s -b "$(jar t1)" -X POST \
  -F "vaultId=$VAULT_ID" -F 'deathDate=2026-08-01' -F 'filerNotes=Filed by trustee' \
  -F "file=@$TMP/cert.pdf;type=application/pdf" \
  -F "notificationFile=@$TMP/notice.pdf;type=application/pdf" \
  "$BASE/api/succession/cases")"
CASE_ID="$(echo "$CLAIM" | jq -r '.case.id // empty')"
check "claim filed with both death proofs" \
  "$([ -n "$CASE_ID" ] && [ "$(echo "$CLAIM" | jq -r '.case.status')" = "awaiting_trustee_otps" ] && echo true || echo false)" \
  "$CLAIM"
check "trustee and guardian slots both created" \
  "$([ "$(echo "$CLAIM" | jq -r '[.approvals[] | select(.role=="trustee")] | length')" = "2" ] && \
     [ "$(echo "$CLAIM" | jq -r '[.approvals[] | select(.role=="guardian")] | length')" = "2" ] && echo true || echo false)" \
  "$(echo "$CLAIM" | jq -c '.approvals')"

confirm() { # confirm <user> <phone> -> response json
  local code
  code="$(api "$1" POST '/api/succession/approve?action=request' \
    "{\"caseId\":\"$CASE_ID\",\"phone\":\"$2\"}" | jq -r '.devCode // empty')"
  api "$1" POST '/api/succession/approve?action=confirm' \
    "{\"caseId\":\"$CASE_ID\",\"phone\":\"$2\",\"code\":\"$code\"}"
}

GUARDIAN_EARLY="$(api g1 POST '/api/succession/approve?action=request' \
  "{\"caseId\":\"$CASE_ID\",\"phone\":\"$G1_PHONE\"}")"
check "guardian cannot confirm before trustees approve" \
  "$(echo "$GUARDIAN_EARLY" | jq -r 'if (.error // "") | length > 0 then "true" else "false" end')" \
  "$GUARDIAN_EARLY"

T1_OK="$(confirm t1 "$T1_PHONE")"
T2_OK="$(confirm t2 "$T2_PHONE")"
check "both trustees approved, case moved to guardians" \
  "$([ "$(echo "$T2_OK" | jq -r '.successionCase.status')" = "awaiting_guardian_confirmations" ] && echo true || echo false)" \
  "$T2_OK"

G1_OK="$(confirm g1 "$G1_PHONE")"
check "first guardian confirmed, case still waiting" \
  "$([ "$(echo "$G1_OK" | jq -r '.successionCase.status')" = "awaiting_guardian_confirmations" ] && \
     [ "$(echo "$G1_OK" | jq -r '.guardianApproved')" = "1" ] && echo true || echo false)" \
  "$G1_OK"

G1_AGAIN="$(api g1 POST '/api/succession/approve?action=request' \
  "{\"caseId\":\"$CASE_ID\",\"phone\":\"$G1_PHONE\"}")"
check "same guardian cannot fill the second slot" \
  "$(echo "$G1_AGAIN" | jq -r 'if (.error // "") | length > 0 then "true" else "false" end')" \
  "$G1_AGAIN"

EARLY_RELEASE="$(api ops POST "/api/ops/succession/$CASE_ID" \
  '{"action":"release_vault","releaseNotes":"too early"}')"
check "release blocked before ops verification" \
  "$(echo "$EARLY_RELEASE" | jq -r 'if (.error // "") | length > 0 then "true" else "false" end')" \
  "$EARLY_RELEASE"

G2_OK="$(confirm g2 "$G2_PHONE")"
check "second guardian completes dual verification" \
  "$([ "$(echo "$G2_OK" | jq -r '.successionCase.status')" = "pending_ops_verification" ] && echo true || echo false)" \
  "$G2_OK"

VERIFY="$(api ops POST "/api/ops/succession/$CASE_ID" \
  '{"decision":"approve","opsNotes":"Certificate and notification checked."}')"
check "ops verified the claim" \
  "$([ "$(echo "$VERIFY" | jq -r '.case.status')" = "succession_verified" ] && echo true || echo false)" \
  "$VERIFY"

GATES="$(api ops GET "/api/ops/succession/$CASE_ID")"
check "server reports the vault as releasable" \
  "$([ "$(echo "$GATES" | jq -r '.gates.canRelease')" = "true" ] && \
     [ "$(echo "$GATES" | jq -r '.gates.blockers | length')" = "0" ] && echo true || echo false)" \
  "$(echo "$GATES" | jq -c '.gates')"

BEFORE_RELEASE="$(api g1 GET "/api/succession/release?caseId=$CASE_ID")"
check "executor view closed until ops release" \
  "$(echo "$BEFORE_RELEASE" | jq -r 'if (.error // "") | test("released") then "true" else "false" end')" \
  "$BEFORE_RELEASE"

RELEASE="$(api ops POST "/api/ops/succession/$CASE_ID" \
  '{"action":"release_vault","releaseNotes":"Family notified by phone."}')"
check "ops released vault access to executors" \
  "$([ "$(echo "$RELEASE" | jq -r '.case.vaultReleasedAt')" != "null" ] && echo true || echo false)" \
  "$RELEASE"

# ---------------------------------------------------------------- executor view
step "11. Executor access to the released vault"
DOSSIER="$(api g1 GET "/api/succession/release?caseId=$CASE_ID")"
check "executor reads the sealed dossier" \
  "$([ "$(echo "$DOSSIER" | jq -r '.assets | length')" = "2" ] && \
     [ "$(echo "$DOSSIER" | jq -r '.beneficiaries | length')" = "2" ] && echo true || echo false)" \
  "$(echo "$DOSSIER" | jq -c '{assets: (.assets|length), heirs: (.beneficiaries|length)}')"
check "dossier carries the advocate stamp reference" \
  "$(echo "$DOSSIER" | jq -r --arg ref "$STAMP_REF" \
     'if any(.documents[]; .stampRef == $ref) then "true" else "false" end')" \
  "$(echo "$DOSSIER" | jq -c '.documents')"
check "dossier carries the transcribed testament" \
  "$(echo "$DOSSIER" | jq -r 'if any(.testaments[]; .transcript | test("Njeri")) then "true" else "false" end')" \
  "$(echo "$DOSSIER" | jq -c '[.testaments[].transcriptStatus]')"

EXEC_AUDIO="$(status g1 GET "/api/vault/testaments/$TESTAMENT_ID/audio")"
check "executor can play the elder's recording (200)" \
  "$([ "$EXEC_AUDIO" = "200" ] && echo true || echo false)" "got $EXEC_AUDIO"

OUTSIDER="$(status t1 GET "/api/succession/release?caseId=$CASE_ID")"
check "confirmed trustee also granted access (200)" \
  "$([ "$OUTSIDER" = "200" ] && echo true || echo false)" "got $OUTSIDER"

# ---------------------------------------------------------------- audit trail
step "12. Audit trail"
AUDIT_ACTIONS="$(jq -r '[.auditLog[].action] | unique | join(" ")' .data/db.json 2>/dev/null || echo "")"
for action in testament_recorded testament_played testament_transcribed \
              guardian_confirmed document_stamped succession_vault_released \
              released_vault_opened advocate_matching_run; do
  check "audit records $action" \
    "$(case " $AUDIT_ACTIONS " in *" $action "*) echo true ;; *) echo false ;; esac)" \
    "recorded: $AUDIT_ACTIONS"
done

# --------------------------------------------------------------------- summary
printf '\n\033[1mResult: %d passed, %d failed\033[0m\n' "$PASS" "$FAIL"
rm -rf "$TMP"
[ "$FAIL" -eq 0 ]
