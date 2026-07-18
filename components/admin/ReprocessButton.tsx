"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiRefreshCw } from "react-icons/fi";
import { Button } from "@/components/ui/Button";

export function ReprocessButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function reprocess() {
    setPending(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/reprocess`, { method: "POST", headers: { "X-Request-ID": crypto.randomUUID() } });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Falha no reprocessamento.");
      setMessage("Pedido reconciliado com sucesso.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha no reprocessamento.");
    } finally { setPending(false); }
  }
  return <div><Button type="button" variant="outline" onClick={reprocess} isLoading={pending} loadingLabel="Reprocessando"><FiRefreshCw />Reprocessar pedido</Button>{message ? <p role="status" className="mt-2 text-xs text-zinc-400">{message}</p> : null}</div>;
}
