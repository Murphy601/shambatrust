import { redirect } from "next/navigation";
import { AdvocateShell } from "@/components/advocate/advocate-shell";
import { readSession } from "@/lib/auth/session";

export default async function AdvocateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();

  // /advocate/login is public; middleware sends unauthenticated desk traffic there.
  if (!session) {
    return <>{children}</>;
  }
  if (session.role !== "advocate") redirect("/vault");

  return (
    <AdvocateShell fullName={session.fullName || "Advocate"}>
      {children}
    </AdvocateShell>
  );
}
