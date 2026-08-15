"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "@/components/locale-provider";

const COUNTY_COPY: Record<
  string,
  { name: string; en: string; sw: string }
> = {
  nyeri: {
    name: "Nyeri",
    en: "Protect family shambas and tea land title deeds across Nyeri with a sealed digital vault.",
    sw: "Linda mashamba ya familia na hati miliki za chai Nyeri kwa hifadhi iliyotiwa muhuri.",
  },
  kiambu: {
    name: "Kiambu",
    en: "From coffee estates to plots near Nairobi — catalog Kiambu land before disputes start.",
    sw: "Kutoka mashamba ya kahawa hadi viwanja karibu na Nairobi — orodhesha ardhi ya Kiambu mapema.",
  },
  nakuru: {
    name: "Nakuru",
    en: "Rift Valley farms and town plots deserve clear heirs and advocate-ready documents.",
    sw: "Mashamba ya Rift Valley na viwanja vya mji yanastahili warithi wazi na nyaraka tayari kwa wakili.",
  },
  mombasa: {
    name: "Mombasa",
    en: "Coastal property and family businesses — secure succession before the next generation argues.",
    sw: "Mali ya pwani na biashara za familia — linda mirathi kabla kizazi kijacho kisigombane.",
  },
};

export default function CountyPage() {
  const params = useParams();
  const slug = String(params.county || "").toLowerCase();
  const { locale } = useLocale();
  const sw = locale === "sw";
  const county = COUNTY_COPY[slug];

  if (!county) {
    return (
      <>
        <SiteHeader />
        <main className="section py-16">
          <h1 className="text-3xl font-semibold text-forest-deep">
            {sw ? "Kaunti haijapatikana" : "County not found"}
          </h1>
          <Link href="/" className="btn btn-primary mt-6">
            Home
          </Link>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="section py-14">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-brass">
          {sw ? "Ardhi · Kenya" : "Land · Kenya"}
        </p>
        <h1 className="brand-font mt-2 text-4xl font-semibold text-forest-deep sm:text-5xl">
          ShambaTrust · {county.name}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          {sw ? county.sw : county.en}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className="btn btn-primary">
            {sw ? "Anza hifadhi" : "Start vault"}
          </Link>
          <Link href="/#audit" className="btn btn-secondary-dark">
            {sw ? "Ukaguzi wa amani" : "Family Peace Audit"}
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
