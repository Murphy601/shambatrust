"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";

const linkClass =
  "text-base font-medium text-slate-200 hover:text-[#D4AF37]";

export function SiteHeader() {
  const { t, locale, toggleLocale } = useLocale();
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const solutionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!solutionsRef.current?.contains(event.target as Node)) {
        setSolutionsOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#0B1D3A] bg-[#0B1D3A] text-white">
        <div className="section flex min-w-0 items-center justify-between gap-3 py-3">
          <Link
            href="/"
            className="brand-font min-w-0 truncate text-xl font-semibold text-white sm:text-2xl md:text-3xl"
            onClick={closeMenu}
          >
            {t.brand}
          </Link>

          <nav className="hidden items-center gap-6 xl:flex">
            <a href="/#how" className={linkClass}>
              {t.nav.how}
            </a>
            <div className="relative" ref={solutionsRef}>
              <button
                type="button"
                className={`${linkClass} inline-flex items-center gap-1`}
                aria-expanded={solutionsOpen}
                onClick={() => setSolutionsOpen((open) => !open)}
              >
                {t.nav.solutions}
                <span aria-hidden className="text-xs">
                  ▾
                </span>
              </button>
              {solutionsOpen ? (
                <div className="absolute left-0 top-full z-50 mt-2 min-w-[16rem] rounded-[0.35rem] border border-white/15 bg-[#0B1D3A] py-2 shadow-lg">
                  <a
                    href="/#audit"
                    className="block px-4 py-2 text-base text-slate-200 hover:bg-white/10 hover:text-[#D4AF37]"
                    onClick={() => setSolutionsOpen(false)}
                  >
                    {t.nav.audit}
                  </a>
                  <a
                    href="/#stories"
                    className="block px-4 py-2 text-base text-slate-200 hover:bg-white/10 hover:text-[#D4AF37]"
                    onClick={() => setSolutionsOpen(false)}
                  >
                    {t.nav.stories}
                  </a>
                  <Link
                    href="/succession-guide"
                    className="block px-4 py-2 text-base text-slate-200 hover:bg-white/10 hover:text-[#D4AF37]"
                    onClick={() => setSolutionsOpen(false)}
                  >
                    {t.nav.succession}
                  </Link>
                </div>
              ) : null}
            </div>
            <a href="/#pricing" className={linkClass}>
              {t.nav.pricing}
            </a>
            <Link href="/advocates" className={linkClass}>
              {t.nav.advocates}
            </Link>
            <Link href="/help-parent" className={linkClass}>
              {t.nav.help}
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={toggleLocale}
              className="hidden text-sm font-semibold tracking-wide text-slate-200 hover:text-[#D4AF37] sm:inline"
              aria-label="Switch language"
            >
              <span className={locale === "en" ? "text-white" : "text-slate-400"}>
                EN
              </span>
              <span className="mx-1 text-slate-500">|</span>
              <span className={locale === "sw" ? "text-white" : "text-slate-400"}>
                SW
              </span>
            </button>
            <Link href="/login" className={`${linkClass} hidden lg:inline`}>
              {t.nav.signIn}
            </Link>
            <Link
              href="/signup"
              className="hidden min-h-11 items-center rounded-[0.35rem] bg-[#1E5631] px-3 text-sm font-semibold text-white hover:bg-[#164526] sm:inline-flex md:px-4 md:text-base"
            >
              {t.nav.getStarted}
            </Link>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-[0.35rem] border border-white/25 text-white xl:hidden"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="text-xl leading-none" aria-hidden>
                {menuOpen ? "×" : "☰"}
              </span>
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav className="max-h-[calc(100svh-4rem)] overflow-y-auto border-t border-white/15 py-4 xl:hidden">
            <div className="section flex flex-col gap-1">
              <a href="/#how" className={`${linkClass} py-2`} onClick={closeMenu}>
                {t.nav.how}
              </a>
              <a href="/#audit" className={`${linkClass} py-2`} onClick={closeMenu}>
                {t.nav.audit}
              </a>
              <a href="/#stories" className={`${linkClass} py-2`} onClick={closeMenu}>
                {t.nav.stories}
              </a>
              <Link
                href="/succession-guide"
                className={`${linkClass} py-2`}
                onClick={closeMenu}
              >
                {t.nav.succession}
              </Link>
              <a href="/#pricing" className={`${linkClass} py-2`} onClick={closeMenu}>
                {t.nav.pricing}
              </a>
              <Link href="/advocates" className={`${linkClass} py-2`} onClick={closeMenu}>
                {t.nav.advocates}
              </Link>
              <Link href="/help-parent" className={`${linkClass} py-2`} onClick={closeMenu}>
                {t.nav.help}
              </Link>
              <Link href="/login" className={`${linkClass} py-2`} onClick={closeMenu}>
                {t.nav.signIn}
              </Link>
              <Link
                href="/signup"
                className="mt-3 inline-flex min-h-11 items-center justify-center rounded-[0.35rem] bg-[#1E5631] px-4 text-base font-semibold text-white"
                onClick={closeMenu}
              >
                {t.nav.getStarted}
              </Link>
              <button
                type="button"
                onClick={() => {
                  toggleLocale();
                  closeMenu();
                }}
                className="mt-2 self-start py-2 text-sm font-semibold tracking-wide text-slate-200"
              >
                <span className={locale === "en" ? "text-white" : "text-slate-400"}>
                  EN
                </span>
                <span className="mx-1 text-slate-500">|</span>
                <span className={locale === "sw" ? "text-white" : "text-slate-400"}>
                  SW
                </span>
              </button>
            </div>
          </nav>
        ) : null}
      </header>
    </>
  );
}
