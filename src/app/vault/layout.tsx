import { redirect } from "next/navigation";
import { VaultShell } from "@/components/vault/vault-shell";
import { readSession } from "@/lib/auth/session";
import { getVaultForUser } from "@/lib/db/store";

export default async function VaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (!session) redirect("/login");

  const access = await getVaultForUser(session.userId);

  return (
    <VaultShell
      fullName={session.fullName || "Member"}
      asAgent={access?.asAgent || session.role === "agent"}
    >
      {children}
    </VaultShell>
  );
}
