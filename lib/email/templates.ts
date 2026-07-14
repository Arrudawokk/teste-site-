import type { EmailMessage, TransactionalEmailData, TransactionalEmailTemplate } from "./types";

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export function renderTransactionalEmail(template: TransactionalEmailTemplate, data: TransactionalEmailData): EmailMessage {
  const name = data.recipientName?.trim() || "cliente";
  const messages: Record<TransactionalEmailTemplate, { subject: string; heading: string; body: string }> = {
    purchase_approved: { subject: `Pagamento aprovado — ${data.productTitle}`, heading: "Pagamento aprovado", body: `Seu pagamento de ${data.formattedAmount} foi confirmado.` },
    payment_pending: { subject: `Pagamento pendente — ${data.productTitle}`, heading: "Pagamento pendente", body: "Seu pedido foi criado e aguarda a confirmação do pagamento." },
    refund_processed: { subject: `Reembolso processado — ${data.productTitle}`, heading: "Reembolso processado", body: "O reembolso foi registrado e o acesso ao produto foi encerrado." },
    product_delivery: { subject: `Seu acesso a ${data.productTitle}`, heading: "Produto liberado", body: "O produto já está disponível em sua biblioteca protegida." },
  };
  const message = messages[template];
  const text = `Olá, ${name}.\n\n${message.body}\n\nPedido: ${data.orderId}\nAcesse: ${data.accountUrl}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#111827"><p>Olá, ${escapeHtml(name)}.</p><h1>${escapeHtml(message.heading)}</h1><p>${escapeHtml(message.body)}</p><p><strong>Pedido:</strong> ${escapeHtml(data.orderId)}</p><p><a href="${escapeHtml(data.accountUrl)}">Acessar minha conta</a></p><p style="color:#6b7280">EscalaHub</p></div>`;
  return { to: data.recipientEmail, subject: message.subject, html, text };
}
