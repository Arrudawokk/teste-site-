import { FiPlus as Plus } from "react-icons/fi";
import type { Product } from "@/lib/catalog";

export function FAQ({ product }: { product: Product }) {
  const questions = product.faq.slice(0, 5);
  return (
    <section id="faq" className="section relative overflow-hidden bg-[#090c12]">
      <div className="pointer-events-none absolute right-[-12rem] top-[-12rem] h-[34rem] w-[34rem] rounded-full bg-blue-600/[.07] blur-[140px]" />
      <div className="container-default grid gap-12 lg:grid-cols-[.7fr_1.3fr]">
        <div><span className="eyebrow">Dúvidas frequentes</span><h2 className="display-title mt-5 text-4xl font-semibold md:text-6xl">Decida com clareza.</h2><p className="mt-5 max-w-sm leading-7 text-zinc-400">Preço, acesso, experiência necessária e garantia explicados sem letras miúdas.</p></div>
        <div className="divide-y divide-white/[.08] border-y border-white/[.08]">
          {questions.map(({ question, answer }) => <details key={question} className="group py-1"><summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 rounded-xl py-5 text-lg font-bold tracking-[-.015em] outline-none transition-colors hover:text-[#b8ff5c] focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-4 focus-visible:ring-offset-[#090c12]"><span>{question}</span><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[.08] bg-white/[.025]"><Plus className="text-zinc-500 transition duration-300 group-open:rotate-45 group-open:text-[#b8ff5c]" /></span></summary><div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 group-open:grid-rows-[1fr]"><div className="overflow-hidden"><p className="max-w-2xl pb-6 pr-10 leading-7 text-zinc-400">{answer}</p></div></div></details>)}
        </div>
      </div>
    </section>
  );
}
