"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiArrowUpRight, FiMenu, FiX } from "react-icons/fi";
import { Button } from "@/components/ui/Button";

type HeaderProps = {
  productHref: string;
  ctaLabel?: string;
  conversionMode?: boolean;
};

export function Header({ productHref, ctaLabel = "Ver o guia", conversionMode = false }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    let animationFrame = 0;
    const updateScrollState = () => {
      setIsScrolled(window.scrollY > 18);
      animationFrame = 0;
    };
    const handleScroll = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateScrollState);
    };

    updateScrollState();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    const shouldLockScroll = window.matchMedia("(max-width: 767px)").matches;
    const previousOverflow = document.body.style.overflow;
    if (shouldLockScroll) document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (shouldLockScroll) document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-500 ease-out supports-[backdrop-filter]:backdrop-blur-2xl ${
        isScrolled
          ? "border-white/[.09] bg-[#06080d]/90 shadow-[0_18px_60px_rgba(0,0,0,.28)] supports-[backdrop-filter]:bg-[#06080d]/78"
          : "border-white/[.045] bg-[#06080d]/58 supports-[backdrop-filter]:bg-[#06080d]/42"
      }`}
    >
      <div
        className={`container-default flex items-center justify-between transition-[height] duration-500 ease-out ${
          isScrolled ? "h-[68px]" : "h-[76px]"
        }`}
      >
        <Link
          href="/"
          className="group flex min-h-11 items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#8cb8ff] focus-visible:ring-offset-4 focus-visible:ring-offset-[#06080d] sm:gap-3"
          aria-label="EscalaHub — início"
          onClick={closeMenu}
        >
          <span className="brand-mark transition-[transform,box-shadow] duration-300 ease-out group-hover:-rotate-3 group-hover:scale-105 group-hover:shadow-[0_0_38px_rgba(184,255,92,.28)] group-active:scale-95">
            <span className="relative">E</span>
          </span>
          <span className="brand-wordmark transition-colors duration-300 group-hover:text-[#edffd6] sm:text-xl">
            EscalaHub
          </span>
        </Link>

        {!conversionMode ? <nav
          className="hidden items-center gap-0.5 rounded-full border border-white/[.075] bg-white/[.035] p-1 text-[13px] font-semibold text-zinc-300 shadow-[inset_0_1px_rgba(255,255,255,.04),0_8px_24px_rgba(0,0,0,.12)] md:flex"
          aria-label="Navegação principal"
        >
          <Link className="inline-flex min-h-10 items-center rounded-full px-4 py-2 transition-[color,background-color,transform] duration-200 hover:-translate-y-px hover:bg-white/[.075] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8cb8ff]" href="/#produto">Produto</Link>
          <Link className="inline-flex min-h-10 items-center rounded-full px-4 py-2 transition-[color,background-color,transform] duration-200 hover:-translate-y-px hover:bg-white/[.075] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8cb8ff]" href="/blog">Blog</Link>
          <Link className="inline-flex min-h-10 items-center rounded-full px-4 py-2 transition-[color,background-color,transform] duration-200 hover:-translate-y-px hover:bg-white/[.075] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8cb8ff]" href="/sobre">Sobre</Link>
          <Link className="inline-flex min-h-10 items-center rounded-full px-4 py-2 transition-[color,background-color,transform] duration-200 hover:-translate-y-px hover:bg-white/[.075] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8cb8ff]" href="/account">Minha conta</Link>
          <Link className="inline-flex min-h-10 items-center rounded-full px-4 py-2 transition-[color,background-color,transform] duration-200 hover:-translate-y-px hover:bg-white/[.075] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8cb8ff]" href="/#faq">Dúvidas</Link>
        </nav> : null}

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button asChild size="sm" className={`group rounded-full px-4 shadow-[0_8px_26px_rgba(134,204,54,.2)] ${conversionMode ? "inline-flex" : "hidden sm:inline-flex"}`}>
            <Link href={productHref}>
              {ctaLabel}
              <FiArrowUpRight className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </Button>
          {!conversionMode ? <Button
            variant="outline"
            size="icon"
            className="rounded-full md:hidden"
            aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen ? <FiX className="h-[18px] w-[18px]" /> : <FiMenu className="h-[18px] w-[18px]" />}
          </Button> : null}
        </div>
      </div>

      {!conversionMode && isMenuOpen ? (
          <div
            id="mobile-navigation"
            className="mobile-menu-enter overflow-hidden border-t border-white/[.07] bg-[#06080d]/96 md:hidden"
          >
            <nav className="container-default flex flex-col gap-1 py-4" aria-label="Navegação mobile">
          <Link className="rounded-xl px-4 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/[.065] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8cb8ff]" href="/#produto" onClick={closeMenu}>Produto</Link>
          <Link className="rounded-xl px-4 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/[.065] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8cb8ff]" href="/blog" onClick={closeMenu}>Blog</Link>
          <Link className="rounded-xl px-4 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/[.065] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8cb8ff]" href="/sobre" onClick={closeMenu}>Sobre</Link>
          <Link className="rounded-xl px-4 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/[.065] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8cb8ff]" href="/account" onClick={closeMenu}>Minha conta</Link>
          <Link className="rounded-xl px-4 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/[.065] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8cb8ff]" href="/#faq" onClick={closeMenu}>Dúvidas</Link>
          <div className="mt-2 border-t border-white/[.07] pt-4">
            <Button asChild size="md" className="group w-full rounded-xl px-3">
              <Link href={productHref} onClick={closeMenu}>
                {ctaLabel}
                <FiArrowUpRight className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </Button>
          </div>
            </nav>
          </div>
        ) : null}
    </header>
  );
}
