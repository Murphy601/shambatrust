import Link from "next/link";

export function PlatformDisclaimer({ sw = false }: { sw?: boolean }) {
  return (
    <p className="rounded-[0.35rem] border border-[#D4AF37]/40 bg-[#F8F9FA] px-4 py-3 text-sm text-[#0B1D3A]">
      {sw
        ? "ShambaTrust ni jukwaa la teknolojia linalounganisha watumiaji na mawakili wa LSK. Sisi si kampuni ya sheria. Wosia na amana zinakuwa halali baada ya wakili kukagua na wewe kutia sahihi mbele ya mashahidi 2."
        : "ShambaTrust is a technology platform connecting you with verified LSK advocates. We are not a law firm. Drafts become legally binding only after advocate review and proper signing (Section 11 of the Law of Succession Act)."}{" "}
      <Link href="/terms" className="font-semibold underline">
        {sw ? "Masharti" : "Terms"}
      </Link>
      {" · "}
      <Link href="/privacy" className="font-semibold underline">
        {sw ? "Faragha / DPA 2019" : "Privacy / DPA 2019"}
      </Link>
    </p>
  );
}
