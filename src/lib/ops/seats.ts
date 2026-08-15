import type { OpsSeatRole } from "@/lib/db/types";

export type { OpsSeatRole };

const ALL: OpsSeatRole[] = ["super", "reviewer", "finance", "compliance"];

/** Parse OPS_SEAT_ROLES=2547…:super,2547…:finance (falls back to super for OPS_ADMIN_PHONES). */
export function getOpsSeatRole(phone: string): OpsSeatRole | null {
  const digits = phone.replace(/\D/g, "");
  const seats = process.env.OPS_SEAT_ROLES || "";
  for (const part of seats.split(",")) {
    const [p, role] = part.trim().split(":");
    if (!p || !role) continue;
    if (p.replace(/\D/g, "") === digits && ALL.includes(role as OpsSeatRole)) {
      return role as OpsSeatRole;
    }
  }
  const admins = process.env.OPS_ADMIN_PHONES || "";
  for (const p of admins.split(",")) {
    if (p.replace(/\D/g, "") === digits) return "super";
  }
  return null;
}

export function seatCan(
  role: OpsSeatRole | null | undefined,
  action:
    | "view_dashboard"
    | "review_applications"
    | "manage_billing"
    | "manage_advocates"
    | "force_lock"
    | "impersonate"
    | "purge_docs"
    | "compliance",
): boolean {
  if (!role) return false;
  if (role === "super") return true;
  switch (action) {
    case "view_dashboard":
      return true;
    case "review_applications":
      return role === "reviewer" || role === "compliance";
    case "manage_billing":
      return role === "finance";
    case "manage_advocates":
      return role === "reviewer" || role === "compliance";
    case "force_lock":
      return role === "compliance" || role === "reviewer";
    case "impersonate":
      return role === "compliance";
    case "purge_docs":
      return role === "compliance";
    case "compliance":
      return role === "compliance";
    default:
      return false;
  }
}
