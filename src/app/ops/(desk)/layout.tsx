import { redirect } from "next/navigation";
import { OpsShell } from "@/components/ops/ops-shell";
import { readSession } from "@/lib/auth/session";

export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  // /ops/login is outside this layout via route group? 
  // Actually login is under /ops/login — need to exclude it from this layout.
  // We'll use a route group: (desk) for protected pages.
  if (!session || session.role !== "admin") {
    redirect("/ops/login");
  }

  return (
    <OpsShell fullName={session.fullName || "Ops"}>{children}</OpsShell>
  );
}
