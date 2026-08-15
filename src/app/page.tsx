import Link from "next/link";
import { FamilyPeaceAudit } from "@/components/family-peace-audit";
import { FloatingWhatsApp } from "@/components/floating-whatsapp";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { LeadCapture } from "@/components/lead-capture";
import { Pricing } from "@/components/pricing";
import { ProblemSolution } from "@/components/problem-solution";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TrustSignals } from "@/components/trust-signals";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <ProblemSolution />
        <HowItWorks />
        <FamilyPeaceAudit />
        <TrustSignals />
        <Pricing />
        <section className="border-t border-border py-14">
          <div className="section grid gap-6 sm:grid-cols-3">
            <Link
              href="/succession-guide"
              className="rounded-[0.45rem] border-2 border-border bg-surface p-5 hover:border-forest"
            >
              <h2 className="text-xl font-semibold text-forest-deep">
                Heir vs trustee
              </h2>
              <p className="mt-2 text-muted">
                How succession filing actually works.
              </p>
            </Link>
            <Link
              href="/advocates"
              className="rounded-[0.45rem] border-2 border-border bg-surface p-5 hover:border-forest"
            >
              <h2 className="text-xl font-semibold text-forest-deep">
                Join as advocate
              </h2>
              <p className="mt-2 text-muted">
                LSK partners — apply, get reviewed, portal login.
              </p>
            </Link>
            <Link
              href="/start"
              className="rounded-[0.45rem] border-2 border-border bg-surface p-5 hover:border-forest"
            >
              <h2 className="text-xl font-semibold text-forest-deep">
                WhatsApp start
              </h2>
              <p className="mt-2 text-muted">
                Vault, succession, or advocate apply from chat.
              </p>
            </Link>
          </div>
        </section>
        <LeadCapture />
      </main>
      <SiteFooter />
      <FloatingWhatsApp />
    </>
  );
}
