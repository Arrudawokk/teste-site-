"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { FiAlertCircle, FiArrowLeft, FiCheck, FiCheckCircle, FiCreditCard, FiDownloadCloud, FiFileText, FiLock, FiMail, FiPackage, FiPlus, FiRefreshCw, FiShield } from "react-icons/fi";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProductEventTracker } from "@/components/analytics/ProductEventTracker";
import { trackPurchase } from "@/lib/analytics";
import { formatProductPrice, getCategoryBySlug, getProductPath, type Product } from "@/lib/catalog";
import type { DeliveryDetails } from "@/lib/payments/types";
import { siteConfig } from "@/lib/site";

type SubmissionStatus = "pending" | "in_process" | "approved" | "rejected" | "cancelled" | "refunded" | "charged_back";

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 30;
const ORDER_RECOVERY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RecoverableOrder = { orderId: string; createdAt: number };

function recoveryKey(productSlug: string): string {
  return `escalahub:stripe-order:${productSlug}`;
}

const nextSteps = [
  { icon: FiFileText, number: "01", title: "Compra", text: "Você preenche seus dados e escolhe a forma de pagamento." },
  { icon: FiCheckCircle, number: "02", title: "Confirmação", text: "O pagamento passa pela confirmação do meio selecionado." },
  { icon: FiShield, number: "03", title: "Liberação", text: "A aprovação libera o acesso ao produto de forma automática." },
  { icon: FiDownloadCloud, number: "04", title: "Download", text: "O botão de download protegido aparece nesta mesma página." },
];

export function Checkout({ product }: { product: Product }) {
  const [complete, setComplete] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [status, setStatus] = useState<SubmissionStatus>("pending");
  const [delivery, setDelivery] = useState<DeliveryDetails | null>(null);
  const [purchaseEventId, setPurchaseEventId] = useState<string | null>(null);
  const [pollingExpired, setPollingExpired] = useState(false);
  const [pollingRun, setPollingRun] = useState(0);
  const purchaseTrackedRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const formattedPrice = formatProductPrice(product);
  const productHref = getProductPath(product);
  const productCategory = getCategoryBySlug(product.category)?.name ?? product.category;
  const trustSignals = [
    { icon: FiShield, title: "Compra protegida", text: `Garantia de ${product.guaranteeDays} dias` },
    { icon: FiLock, title: "Dados protegidos", text: "Conexão segura" },
    { icon: FiDownloadCloud, title: "Produto digital", text: "Acesso após confirmação" },
    { icon: FiDownloadCloud, title: "Download protegido", text: "Link temporário após aprovação" },
  ];
  const quickQuestions = [
    { question: "Quando recebo o acesso?", answer: "O acesso é liberado automaticamente nesta página assim que o pagamento for aprovado." },
    { question: "Como acesso o material?", answer: `Após a aprovação, use o botão de download protegido para baixar ${product.title}.` },
    { question: "Posso baixar novamente?", answer: `O acesso ao material é ${product.accessLabel.toLowerCase()}. Guarde o arquivo baixado em um local seguro.` },
    { question: "Como funciona a garantia?", answer: `Você pode avaliar o material por ${product.guaranteeDays} dias e solicitar reembolso dentro desse prazo.` },
  ];

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        if (new URLSearchParams(window.location.search).has("stripe")) return;
        const stored = window.localStorage.getItem(recoveryKey(product.slug));
        if (!stored) return;
        const recovery = JSON.parse(stored) as Partial<RecoverableOrder>;
        if (
          !recovery.orderId ||
          !UUID_PATTERN.test(recovery.orderId) ||
          typeof recovery.createdAt !== "number" ||
          Date.now() - recovery.createdAt > ORDER_RECOVERY_MAX_AGE_MS
        ) {
          window.localStorage.removeItem(recoveryKey(product.slug));
          return;
        }
        setOrderId(recovery.orderId);
        setComplete(true);
        setStatus("pending");
      } catch {
        window.localStorage.removeItem(recoveryKey(product.slug));
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [product.slug]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const stripeResult = params.get("stripe");
      const returnedOrderId = params.get("orderId");
      if (!stripeResult || !returnedOrderId || !UUID_PATTERN.test(returnedOrderId)) return;

      if (stripeResult === "cancelled") {
        try {
          window.localStorage.removeItem(recoveryKey(product.slug));
        } catch {
          // O cancelamento continua válido sem armazenamento local.
        }
        idempotencyKeyRef.current = null;
        setErrorMessage("Pagamento cancelado. Nenhuma cobrança foi confirmada e você pode tentar novamente.");
      } else if (stripeResult === "success") {
        setOrderId(returnedOrderId);
        setComplete(true);
        setStatus("pending");
        try {
          const recovery: RecoverableOrder = { orderId: returnedOrderId, createdAt: Date.now() };
          window.localStorage.setItem(recoveryKey(product.slug), JSON.stringify(recovery));
        } catch {
          // O polling continua normalmente sem armazenamento local.
        }
      }

      window.history.replaceState(null, "", `/checkout?product=${encodeURIComponent(product.slug)}`);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [product.slug]);

  useEffect(() => {
    if (errorMessage) errorRef.current?.focus();
  }, [errorMessage]);

  useEffect(() => {
    if (!orderId || status === "approved" || status === "rejected" || status === "cancelled" || status === "refunded" || status === "charged_back") return;

    let attempts = 0;
    let cancelled = false;
    let timeout = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const response = await fetch(`/api/payments/status?orderId=${orderId}`, { cache: "no-store" });
        if (response.ok) {
          const data = (await response.json()) as { status: SubmissionStatus; delivery: DeliveryDetails; purchaseEventId?: string; accountUrl?: string };
          if (cancelled) return;
          setStatus(data.status);
          setDelivery(data.delivery);
          setPurchaseEventId(data.purchaseEventId ?? null);
        }
      } catch {
        // Falha de rede pontual: a próxima tentativa do polling cobre o caso.
      }

      if (cancelled) return;
      if (attempts >= MAX_POLL_ATTEMPTS) {
        setPollingExpired(true);
        return;
      }
      timeout = window.setTimeout(poll, POLL_INTERVAL_MS);
    };

    timeout = window.setTimeout(poll, 1_000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [orderId, pollingRun, status]);

  useEffect(() => {
    if (status === "approved" && !purchaseTrackedRef.current && purchaseEventId) {
      purchaseTrackedRef.current = true;
      trackPurchase(
        { slug: product.slug, title: product.title, price: product.price, currency: product.currency, category: productCategory },
        { transactionId: purchaseEventId, value: product.price },
      );
    }
  }, [status, purchaseEventId, product, productCategory]);

  async function finishOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");
    const payer = { name, email };

    setSubmitting(true);
    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKeyRef.current ?? (idempotencyKeyRef.current = crypto.randomUUID()),
        },
        body: JSON.stringify({ productSlug: product.slug, payer }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        orderId?: string;
        status?: SubmissionStatus;
        checkoutUrl?: string;
        delivery?: DeliveryDetails;
        purchaseEventId?: string;
        accountUrl?: string;
        error?: string;
      };
      if (!response.ok || !data.orderId || !data.status) {
        if (response.status >= 400 && response.status < 500) idempotencyKeyRef.current = null;
        throw new Error(data.error || "Não foi possível concluir o pagamento.");
      }

      setOrderId(data.orderId);
      setStatus(data.status);
      setDelivery(data.delivery ?? null);
      setPurchaseEventId(data.purchaseEventId ?? null);

      if (data.status === "rejected" || data.status === "cancelled") {
        idempotencyKeyRef.current = null;
        throw new Error("Não foi possível iniciar o pagamento. Tente novamente.");
      }

      try {
        const recovery: RecoverableOrder = { orderId: data.orderId, createdAt: Date.now() };
        window.localStorage.setItem(recoveryKey(product.slug), JSON.stringify(recovery));
      } catch {
        // A compra continua normalmente mesmo quando o navegador bloqueia o armazenamento local.
      }

      if (data.status === "approved") {
        setComplete(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (!data.checkoutUrl) throw new Error("A Stripe não retornou uma página de pagamento válida.");
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível concluir o pagamento.");
    } finally {
      setSubmitting(false);
    }
  }

  if (complete) {
    const statusLabel: Record<SubmissionStatus, string> = {
      pending: "Aguardando confirmação",
      in_process: "Processando",
      approved: "Pagamento aprovado",
      rejected: "Pagamento recusado",
      cancelled: "Pagamento cancelado",
      refunded: "Pagamento reembolsado",
      charged_back: "Pagamento contestado",
    };
    const isApproved = status === "approved";
    const isFailed = status === "rejected" || status === "cancelled" || status === "refunded" || status === "charged_back";
    const statusColor = isFailed ? "text-red-300" : "text-[#b8ff5c]";

    const resetPaymentAttempt = () => {
      try {
        window.localStorage.removeItem(recoveryKey(product.slug));
      } catch {
        // Sem armazenamento local, basta limpar o estado atual.
      }
      idempotencyKeyRef.current = null;
      purchaseTrackedRef.current = false;
      setComplete(false);
      setOrderId(null);
      setStatus("pending");
      setDelivery(null);
      setPurchaseEventId(null);
      setPollingExpired(false);
      setErrorMessage(null);
    };

    return (
      <main className="noise grid min-h-screen place-items-center bg-[#070a10] px-5 py-16">
        <div className="relative w-full max-w-xl overflow-hidden rounded-[32px] border border-white/[.1] bg-[#0d1119] p-7 text-center shadow-[0_35px_110px_rgba(0,0,0,.42)] sm:p-10 md:p-12">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#b8ff5c]/10 blur-[90px]" />
          <span className={`relative mx-auto grid h-16 w-16 place-items-center rounded-full text-2xl shadow-[0_16px_50px_rgba(184,255,92,.2)] ${isFailed ? "bg-red-400 text-red-950" : "bg-[#b8ff5c] text-black"}`}>
            {isFailed ? <FiAlertCircle aria-hidden="true" /> : isApproved ? <FiCheck aria-hidden="true" /> : <FiRefreshCw className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          </span>
          <p className="eyebrow relative mt-8 justify-center" aria-live="polite">Próxima etapa</p>
          <h1 className="display-title relative mt-4 text-4xl font-semibold text-white md:text-5xl" aria-live="polite">
            {isFailed ? "Pagamento não concluído." : isApproved ? "Pagamento aprovado." : "Confirmando pagamento."}
          </h1>
          <p className="relative mx-auto mt-5 max-w-md leading-7 text-zinc-300">
            {isFailed ? (
              "A cobrança não foi concluída. Você pode voltar ao checkout e tentar novamente com segurança."
            ) : isApproved && delivery?.status === "ready" ? (
              "Seu acesso está liberado. Use o botão abaixo para baixar o material com segurança."
            ) : isApproved ? (
              <>Seu pagamento foi confirmado. Se o download não aparecer, fale com o suporte pelo e-mail <strong className="text-white">{siteConfig.contactEmail}</strong>.</>
            ) : (
              "A confirmação pode levar alguns minutos. Esta página será atualizada automaticamente."
            )}
          </p>

          {errorMessage ? <div ref={errorRef} role="alert" tabIndex={-1} className="relative mt-5 flex items-start gap-3 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-left text-sm text-red-100 outline-none focus-visible:ring-2 focus-visible:ring-red-300"><FiAlertCircle className="mt-0.5 shrink-0" aria-hidden="true" /><span>{errorMessage}</span></div> : null}

          <div className="relative mt-8 rounded-2xl border border-white/[.08] bg-white/[.035] p-5 text-left">
            <div className="flex justify-between text-sm"><span className="text-zinc-500">Total</span><strong className="text-white">{formattedPrice}</strong></div>
            <div className="mt-3 flex justify-between text-sm"><span className="text-zinc-500">Status</span><span className={`font-bold ${statusColor}`}>{statusLabel[status]}</span></div>
          </div>
          <p className="relative mt-5 text-xs leading-5 text-zinc-500">Pedido: <span className="font-mono text-zinc-400">{orderId}</span>. Guarde este código para recuperar o acesso, se necessário.</p>
          {isFailed ? (
            <Button type="button" size="lg" className="relative mt-8 w-full" onClick={resetPaymentAttempt}>Tentar novamente</Button>
          ) : isApproved && delivery?.status === "ready" ? (
            <div className="relative mt-8 grid gap-3"><Button asChild size="lg" className="w-full"><a href={delivery.downloadUrl}><FiDownloadCloud /> Baixar meu e-book</a></Button><Button asChild variant="outline" size="lg" className="w-full"><Link href="/account"><FiPackage /> Acessar minha biblioteca</Link></Button></div>
          ) : isApproved ? (
            <Button asChild variant="outline" size="lg" className="relative mt-8 w-full"><a href={`mailto:${siteConfig.contactEmail}`}><FiMail /> Falar com o suporte</a></Button>
          ) : (
            <>
              {pollingExpired ? <Button type="button" size="lg" className="relative mt-8 w-full" onClick={() => { setPollingExpired(false); setPollingRun((run) => run + 1); }}><FiRefreshCw /> Verificar pagamento novamente</Button> : null}
              <Button asChild variant={pollingExpired ? "outline" : "primary"} size="lg" className={`relative w-full ${pollingExpired ? "mt-3" : "mt-8"}`}><Link href="/">Voltar para a EscalaHub</Link></Button>
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <main data-checkout className="relative min-h-screen overflow-hidden bg-[#070a10]">
      <ProductEventTracker event="InitiateCheckout" product={{ slug: product.slug, title: product.title, price: product.price, currency: product.currency, category: productCategory }} />
      <div className="premium-grid pointer-events-none fixed inset-0 opacity-30" />
      <div className="pointer-events-none fixed -left-52 top-20 h-[520px] w-[520px] rounded-full bg-blue-600/[.08] blur-[150px]" />
      <div className="pointer-events-none fixed -right-52 bottom-0 h-[500px] w-[500px] rounded-full bg-violet-600/[.07] blur-[150px]" />

      <header className="relative border-b border-white/[.07] bg-[#070a10]/80 backdrop-blur-2xl">
        <div className="container-default flex h-[76px] items-center justify-between">
          <Link href="/" className="group flex min-h-11 items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-4 focus-visible:ring-offset-[#070a10] sm:gap-3" aria-label="EscalaHub — página inicial">
            <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#b8ff5c] text-sm font-black text-black shadow-[0_0_30px_rgba(184,255,92,.16)] transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105">E</span>
            <span className="display-title text-[19px] font-bold text-white sm:text-xl">EscalaHub</span>
          </Link>
          <Badge variant="neutral" className="border-white/[.1] bg-white/[.055] py-2 text-zinc-100"><FiLock className="text-[#b8ff5c]" aria-hidden="true" /> <span className="hidden sm:inline">Ambiente seguro</span><span className="sm:hidden">Seguro</span></Badge>
        </div>
      </header>

      <div className="container-default relative pb-28 pt-8 sm:pb-32 sm:pt-10 md:pt-14 lg:pb-14">
        <Link href={productHref} className="inline-flex min-h-11 items-center gap-2 rounded-lg py-2 text-sm font-semibold text-zinc-300 outline-none transition-[color,transform] hover:-translate-x-0.5 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-4 focus-visible:ring-offset-[#070a10]" aria-label={`Voltar para ${product.title}`}><FiArrowLeft /> Voltar para o produto</Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.08fr_.92fr] lg:items-start lg:gap-14">
          <form id="checkout-form" onSubmit={finishOrder} className="space-y-8" aria-label="Finalizar compra" aria-busy={submitting}>
            <div>
              <p className="eyebrow">Checkout seguro</p>
              <h1 className="display-title mt-3 text-3xl font-semibold text-white sm:text-4xl">Falta pouco para acessar.</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">Confirme seus dados e continue para o ambiente seguro da Stripe. O acesso é liberado após a aprovação.</p>
            </div>

            <section aria-labelledby="checkout-dados-title">
              <div className="mb-5 flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#b8ff5c] text-sm font-black text-black">1</span><div><h2 id="checkout-dados-title" className="display-title text-2xl font-bold text-white">Seus dados</h2><p className="mt-0.5 text-xs text-zinc-500">O e-mail identifica sua compra e permite contato de suporte.</p></div></div>
              <div className="grid gap-4 rounded-[26px] border border-white/[.085] bg-white/[.025] p-5 shadow-[inset_0_1px_rgba(255,255,255,.025),0_24px_70px_rgba(0,0,0,.12)] md:grid-cols-2 md:p-6">
                <label><span className="mb-2 block text-xs font-bold text-zinc-300">Nome completo</span><Input required name="name" autoComplete="name" minLength={2} maxLength={120} placeholder="Seu nome completo" /></label>
                <label><span className="mb-2 block text-xs font-bold text-zinc-300">E-mail</span><Input required type="email" name="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" /></label>
              </div>
            </section>

            <section aria-labelledby="checkout-pagamento-title">
              <div className="mb-5 flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#b8ff5c] text-sm font-black text-black">2</span><div><h2 id="checkout-pagamento-title" className="display-title text-2xl font-bold text-white">Pagamento</h2><p className="mt-0.5 text-xs text-zinc-500">Cartão e Pix são processados no checkout seguro da Stripe.</p></div></div>
              <div className="rounded-[26px] border border-white/[.085] bg-white/[.025] p-5 sm:p-6">
                <div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#b8ff5c]/10 text-xl text-[#b8ff5c]"><FiCreditCard aria-hidden="true" /></span><div><h3 className="font-bold text-white">Pagamento protegido pela Stripe</h3><p className="mt-2 text-sm leading-6 text-zinc-400">Na próxima etapa, escolha uma forma de pagamento disponível e conclua sem compartilhar os dados financeiros com a EscalaHub.</p></div></div>
              </div>
            </section>

            {errorMessage ? (
              <div ref={errorRef} role="alert" tabIndex={-1} className="flex items-start gap-3 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100 outline-none focus-visible:ring-2 focus-visible:ring-red-300">
                <FiAlertCircle className="mt-0.5 shrink-0" aria-hidden="true" /> <span>{errorMessage}</span>
              </div>
            ) : null}

            <div className="rounded-[26px] border border-[#b8ff5c]/20 bg-[#b8ff5c]/[.055] p-3 shadow-[0_20px_60px_rgba(184,255,92,.06)]">
              <Button type="submit" size="lg" isLoading={submitting} loadingLabel="Processando pagamento" className="group h-16 w-full rounded-2xl px-5 text-base shadow-[0_16px_50px_rgba(134,204,54,.32)] focus-visible:ring-[#b8ff5c] sm:px-7">
                <span>Continuar para pagamento</span>
                <span className="ml-auto flex items-center gap-2 border-l border-black/15 pl-4">{formattedPrice} <FiCheckCircle className="transition-transform duration-200 group-hover:scale-110" /></span>
              </Button>
              <p className="mt-3 flex items-center justify-center gap-2 px-2 text-center text-[11px] font-medium text-zinc-400"><FiLock className="text-[#b8ff5c]" /> Seus dados são enviados em ambiente protegido.</p>
            </div>
          </form>

          <aside className="order-last lg:sticky lg:top-6 lg:h-fit" aria-label="Resumo do pedido">
            <div className="overflow-hidden rounded-[30px] border border-white/[.1] bg-[#0d1119] shadow-[0_30px_90px_rgba(0,0,0,.28)]">
              <div className="border-b border-white/[.08] bg-gradient-to-br from-blue-500/[.1] via-transparent to-violet-500/[.07] p-5 sm:p-7">
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#b8ff5c]">Seu pedido</p>
                <div className="mt-5 flex gap-4">
                  <div className="h-32 w-[92px] shrink-0 overflow-hidden rounded-xl border border-white/[.08] bg-[#080b10] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,.35)]"><Image src={product.coverImage} alt={`Capa de ${product.title}`} width={184} height={256} sizes="92px" className="h-full w-full rounded-lg object-contain" /></div>
                  <div className="min-w-0"><Badge variant="neutral" className="border-white/[.1] bg-white/[.055] text-zinc-100">Produto digital</Badge><h2 className="mt-3 font-bold leading-snug text-white">{product.title}</h2><p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400"><FiDownloadCloud className="text-[#b8ff5c]" /> Acesso após confirmação</p></div>
                </div>
              </div>

              <div className="p-5 sm:p-7">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/[.07] bg-white/[.025] p-3"><FiFileText className="text-[#b8ff5c]" /><span className="mt-2 block text-[9px] font-bold uppercase tracking-[.1em] text-zinc-500">Formato</span><strong className="mt-1 block text-xs text-white">{product.format}</strong></div>
                  <div className="rounded-2xl border border-white/[.07] bg-white/[.025] p-3"><FiDownloadCloud className="text-[#b8ff5c]" /><span className="mt-2 block text-[9px] font-bold uppercase tracking-[.1em] text-zinc-500">Acesso</span><strong className="mt-1 block text-xs text-white">{product.accessLabel}</strong></div>
                </div>
                <div className="mt-5 space-y-3 border-y border-white/[.08] py-5 text-sm"><div className="flex justify-between"><span className="text-zinc-500">Produto</span><span className="text-zinc-300">{formattedPrice}</span></div><div className="flex justify-between"><span className="text-zinc-500">Taxas</span><span className="text-zinc-300">R$ 0,00</span></div></div>
                <div className="pt-5"><span className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">Pagamento único</span><div className="mt-1 flex items-end justify-between"><span className="font-bold text-white">Total</span><strong className="display-title text-4xl font-black tracking-[-.045em] text-white">{formattedPrice}</strong></div></div>
              </div>
            </div>

            <div className="mt-4 rounded-[24px] border border-[#b8ff5c]/20 bg-[#b8ff5c]/[.055] p-5">
              <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#b8ff5c]/10 text-xl text-[#b8ff5c]"><FiShield /></span><div><h3 className="font-bold text-white">Garantia de {product.guaranteeDays} dias</h3><p className="mt-1 text-xs leading-5 text-zinc-400">Você pode avaliar o material e solicitar reembolso dentro do prazo da garantia.</p></div></div>
            </div>
          </aside>
        </div>

        <section className="mt-14 border-t border-white/[.07] pt-12 sm:mt-16 sm:pt-16" aria-labelledby="checkout-confianca-title">
          <div className="text-center"><p className="eyebrow justify-center">Antes de pagar</p><h2 id="checkout-confianca-title" className="display-title mt-4 text-3xl font-semibold text-white sm:text-4xl">Tudo claro, sem surpresas.</h2></div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {trustSignals.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-[22px] border border-white/[.08] bg-white/[.025] p-5 shadow-[inset_0_1px_rgba(255,255,255,.025)]">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#b8ff5c]/10 bg-[#b8ff5c]/[.08] text-lg text-[#b8ff5c]"><Icon aria-hidden="true" /></span>
                <h3 className="mt-5 text-sm font-bold text-white">{title}</h3><p className="mt-1.5 text-xs text-zinc-500">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-[30px] border border-white/[.085] bg-[#0b0f16]/85 p-6 shadow-[0_28px_90px_rgba(0,0,0,.2)] backdrop-blur-xl sm:p-8 lg:p-10" aria-labelledby="checkout-proximos-passos-title">
          <div className="grid gap-6 lg:grid-cols-[.68fr_1.32fr] lg:items-end"><div><p className="eyebrow">Depois do pagamento</p><h2 id="checkout-proximos-passos-title" className="display-title mt-4 text-3xl font-semibold text-white sm:text-4xl">O que acontece a seguir.</h2></div><p className="max-w-xl text-sm leading-6 text-zinc-400 lg:justify-self-end">Um processo simples, do preenchimento dos dados até a liberação do produto digital.</p></div>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {nextSteps.map(({ icon: Icon, number, title, text }) => (
              <li key={number} className="relative rounded-[22px] border border-white/[.075] bg-white/[.025] p-5">
                <div className="flex items-center justify-between"><Icon className="text-xl text-[#b8ff5c]" aria-hidden="true" /><span className="font-mono text-[10px] font-bold text-zinc-600">{number}</span></div>
                <h3 className="mt-5 font-bold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16 grid gap-10 pb-8 lg:grid-cols-[.68fr_1.32fr] lg:gap-14" aria-labelledby="checkout-duvidas-title">
          <div><p className="eyebrow">Perguntas rápidas</p><h2 id="checkout-duvidas-title" className="display-title mt-4 text-3xl font-semibold text-white sm:text-4xl">Antes de finalizar.</h2><p className="mt-4 max-w-md text-sm leading-6 text-zinc-400">Respostas diretas para concluir sua compra com segurança.</p><div className="mt-6 flex items-center gap-2 text-xs font-semibold text-zinc-400"><FiRefreshCw className="text-[#b8ff5c]" /> Garantia de 7 dias</div></div>
          <div className="divide-y divide-white/[.08] border-y border-white/[.08]">
            {quickQuestions.map(({ question, answer }) => (
              <details key={question} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 rounded-xl py-5 text-left font-bold text-white outline-none transition-colors hover:text-[#b8ff5c] focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-4 focus-visible:ring-offset-[#070a10]"><span>{question}</span><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/[.1] bg-white/[.035] text-zinc-400 transition-[transform,color] duration-300 group-open:rotate-45 group-open:text-[#b8ff5c]"><FiPlus aria-hidden="true" /></span></summary>
                <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 group-open:grid-rows-[1fr]"><div className="overflow-hidden"><p className="pb-5 pr-9 text-sm leading-6 text-zinc-400">{answer}</p></div></div>
              </details>
            ))}
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[.1] bg-[#080b10]/92 px-4 py-3 shadow-[0_-18px_55px_rgba(0,0,0,.38)] backdrop-blur-2xl lg:hidden">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="shrink-0"><span className="block text-[9px] font-bold uppercase tracking-[.1em] text-zinc-500">Pagamento único</span><strong className="display-title mt-0.5 block text-xl font-black text-white">{formattedPrice}</strong></div>
          <Button type="submit" form="checkout-form" size="md" isLoading={submitting} loadingLabel="Abrindo Stripe" className="ml-auto h-12 min-w-44 flex-1 rounded-xl px-4 text-sm shadow-[0_12px_36px_rgba(134,204,54,.28)]" aria-label={`Continuar para pagamento seguro de ${formattedPrice}`}>
            Continuar
          </Button>
        </div>
      </div>
    </main>
  );
}
