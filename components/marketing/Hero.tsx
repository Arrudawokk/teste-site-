"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, MotionConfig } from "framer-motion";
import { FiArrowRight, FiCheck, FiLayers, FiShield, FiTrendingUp } from "react-icons/fi";
import { Button } from "@/components/ui/Button";
import { formatProductPrice, getProductPath, type Product } from "@/lib/catalog";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero({ product }: { product: Product }) {
  const stats = [
    { value: String(product.modules.length), label: "módulos em sequência" },
    { value: String(product.platforms.length), label: "plataformas abordadas" },
    { value: `${product.guaranteeDays} dias`, label: "de garantia" },
  ];
  const productHref = getProductPath(product);
  const [titleLead, ...titleRest] = product.title.split(":");
  const formattedPrice = formatProductPrice(product);
  return (
    <MotionConfig reducedMotion="user">
      <section className="noise relative min-h-screen overflow-hidden border-b border-white/[.055] pt-[76px]">
        <div className="premium-grid pointer-events-none absolute inset-0 opacity-80" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/20 to-transparent" />
        <div className="pointer-events-none absolute left-[-20%] top-[-34%] h-[820px] w-[820px] rounded-full bg-blue-600/[.14] blur-[180px]" />
        <div className="pointer-events-none absolute right-[-14%] top-[2%] h-[700px] w-[700px] rounded-full bg-violet-700/[.11] blur-[180px]" />
        <div className="pointer-events-none absolute bottom-[-34%] left-[32%] h-[520px] w-[520px] rounded-full bg-cyan-500/[.055] blur-[150px]" />

        <div className="container-default relative grid min-h-[calc(100vh-76px)] items-center gap-14 py-16 sm:py-20 lg:grid-cols-[1.03fr_.97fr] lg:gap-10 lg:py-20 xl:gap-16 xl:py-24">
          <div className="relative z-10 max-w-[680px] lg:pb-2">
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
              <span className="eyebrow rounded-full border border-[#b8ff5c]/20 bg-[#b8ff5c]/[.065] px-3.5 py-2 shadow-[inset_0_1px_rgba(255,255,255,.05),0_8px_32px_rgba(184,255,92,.04)] backdrop-blur-xl">
                <span className="h-1.5 w-1.5 rounded-full bg-[#b8ff5c]" />
                Guia prático para anunciar com método
              </span>
            </motion.div>

            <motion.h1
              className="display-title mt-7 max-w-[670px] text-[clamp(3.55rem,7.15vw,7rem)] font-semibold leading-[.88] text-white sm:mt-8"
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease }}
            >
              {titleLead}{titleRest.length > 0 ? ":" : ""}<br />
              {titleRest.length > 0 ? <span className="gradient-text">{titleRest.join(":").trim()}.</span> : null}
            </motion.h1>

            <motion.p
              className="mt-7 max-w-[590px] text-[17px] leading-7 text-zinc-300 sm:mt-8 sm:text-lg sm:leading-8 md:text-xl md:leading-9"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.16, ease }}
            >
              {product.shortDescription}
            </motion.p>

            <motion.div
              className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:items-center"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.24, ease }}
            >
              <Button asChild size="lg" className="group min-w-60 shadow-[0_14px_42px_rgba(134,204,54,.24)] focus-visible:ring-[#b8ff5c]">
                <Link href={productHref}>
                  Conhecer o método por {formattedPrice}
                  <FiArrowRight className="transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-white/[.14] bg-white/[.045] backdrop-blur-xl hover:border-white/[.22]">
                <a href="#produto">Ver conteúdo e benefícios</a>
              </Button>
            </motion.div>

            <motion.div
              className="mt-10 grid max-w-[590px] grid-cols-3 overflow-hidden rounded-2xl border border-white/[.075] bg-white/[.025] p-1 shadow-[inset_0_1px_rgba(255,255,255,.035),0_18px_50px_rgba(0,0,0,.12)] backdrop-blur-xl sm:mt-12"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.32, ease }}
            >
              {stats.map((stat) => (
                <div key={stat.label} className="relative px-2.5 py-3.5 text-center after:absolute after:right-0 after:top-1/2 after:h-8 after:w-px after:-translate-y-1/2 after:bg-white/[.075] last:after:hidden sm:px-5 sm:py-4 sm:text-left">
                  <strong className="display-title block text-lg font-bold text-white sm:text-2xl">{stat.value}</strong>
                  <span className="mt-1 block text-[10px] font-medium leading-4 text-zinc-400 sm:text-xs">{stat.label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            className="relative mx-auto w-[calc(100%_-_1.5rem)] max-w-[500px] sm:w-full lg:mr-0 xl:max-w-[540px]"
            initial={{ opacity: 0, x: 28, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.72, delay: 0.16, ease }}
          >
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[76%] w-[76%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/25 blur-[105px]" />
            <div className="pointer-events-none absolute left-[5%] top-[9%] h-52 w-52 rounded-full bg-violet-500/[.17] blur-[85px]" />
            <div className="pointer-events-none absolute bottom-[2%] right-[2%] h-44 w-44 rounded-full bg-cyan-400/[.12] blur-[80px]" />

            <div className="relative px-7 py-6 sm:px-10">
              <motion.div
                className="relative rounded-[28px] border border-blue-200/[.16] bg-gradient-to-br from-[#121b2b] via-[#0a0f18] to-[#06080d] p-2.5 shadow-[0_48px_110px_rgba(0,0,0,.58),0_0_110px_rgba(59,130,246,.2),inset_0_1px_rgba(255,255,255,.08)]"
                style={{ transformPerspective: 1200, rotateY: -7, rotateX: 2, transformStyle: "preserve-3d" }}
                whileHover={{ scale: 1.015, rotateY: -3, rotateX: 0 }}
                transition={{ duration: 0.35, ease }}
              >
                <div className="absolute bottom-3 left-[-14px] top-3 w-4 rounded-l-md border-y border-l border-blue-200/[.12] bg-gradient-to-r from-[#030509] to-[#18243a] shadow-[-12px_16px_34px_rgba(0,0,0,.62)]" />
                <div className="absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-blue-200/55 to-transparent" />
                <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-white/[.045] via-transparent to-blue-400/[.025]" />
                <Image
                  src={product.coverImage}
                  alt={`Mockup de ${product.title}`}
                  width={1024}
                  height={1536}
                  preload
                  sizes="(max-width: 640px) 82vw, (max-width: 1024px) 470px, 500px"
                  className="relative h-auto w-full rounded-[20px] object-cover shadow-[0_18px_42px_rgba(0,0,0,.34)]"
                />
              </motion.div>
            </div>

            <motion.div
              className="glass absolute -left-1 bottom-[15%] rounded-2xl p-3.5 shadow-[0_20px_55px_rgba(0,0,0,.38)] sm:-left-8 sm:p-4"
              initial={{ opacity: 0, x: -16, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.48, ease }}
              whileHover={{ scale: 1.025, y: -2 }}
            >
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400"><FiTrendingUp className="text-[#b8ff5c]" /> Método prático</span>
              <p className="mt-1.5 max-w-48 text-sm font-bold text-white">{product.title}</p>
            </motion.div>

            <motion.div
              className="glass absolute -right-1 top-[13%] rounded-2xl p-3.5 shadow-[0_20px_55px_rgba(0,0,0,.38)] sm:-right-7 sm:p-4"
              initial={{ opacity: 0, x: 16, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.56, ease }}
              whileHover={{ scale: 1.025, y: -2 }}
            >
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400"><FiLayers className="text-blue-400" /> Conteúdo</span>
              <p className="mt-1.5 text-sm font-bold text-white">{product.modules.length} módulos práticos</p>
            </motion.div>

            <motion.div
              className="absolute bottom-0 right-[7%] flex items-center gap-2 rounded-full border border-[#b8ff5c]/25 bg-[#081009]/92 px-3 py-2 text-[10px] font-bold text-[#b8ff5c] shadow-[0_12px_38px_rgba(184,255,92,.1)] backdrop-blur-xl"
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, delay: 0.64, ease }}
            >
              <FiShield /><FiCheck /> Acesso digital e seguro
            </motion.div>
          </motion.div>
        </div>
      </section>
    </MotionConfig>
  );
}
