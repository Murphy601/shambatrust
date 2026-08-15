import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVaultAccess } from "@/lib/vault-access";
import { normalizeKenyanPhone } from "@/lib/auth/phone";
import { addAudit, inviteAgent, listAgentLinks } from "@/lib/db/store";

const schema = z.object({
  agentPhone: z.string().min(9),
});

export async function GET() {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const agents = await listAgentLinks(access.vault.id);
  return NextResponse.json({ agents, asAgent: access.asAgent });
}

export async function POST(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (access.asAgent) {
    return NextResponse.json(
      { error: "Only the elder can invite an agent." },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid phone." }, { status: 400 });
  }

  const agentPhone = normalizeKenyanPhone(parsed.data.agentPhone);
  if (!agentPhone) {
    return NextResponse.json(
      { error: "Use a valid Kenyan number." },
      { status: 400 },
    );
  }

  if (agentPhone === access.session.phone) {
    return NextResponse.json(
      { error: "Invite a family member, not yourself." },
      { status: 400 },
    );
  }

  const link = await inviteAgent(
    access.vault.id,
    access.session.userId,
    agentPhone,
  );

  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: "agent_invited",
    detail: agentPhone,
  });

  return NextResponse.json({ agent: link });
}
