"use client";

import Link from "next/link";
import { FamilyPeaceAudit } from "@/components/family-peace-audit";
import { FloatingWhatsApp } from "@/components/floating-whatsapp";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "@/components/locale-provider";

export default function AuditPage() {
  const { t } = useLocale();

  return (
    <>
      <SiteHeader />
      <main className="pb-8 pt-6">
        <div className="section">
          <Link
            href="/#audit"
            className="text-base font-semibold text-forest underline-offset-4 hover:underline"
          >
            ← {t.auditPage.backHome}
          </Link>
        </div>
        <FamilyPeaceAudit compact />
      </main>
      <SiteFooter />
      <FloatingWhatsApp />
    </>
  );
}
