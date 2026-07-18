"use client";

import { FiAlertTriangle, FiRefreshCw } from "react-icons/fi";
import { Button } from "@/components/ui/Button";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="card grid min-h-96 place-items-center p-8 text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-400/10 text-red-200"><FiAlertTriangle /></span><h1 className="display-title mt-5 text-2xl font-semibold">Dados operacionais indisponíveis</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400">Não foi possível carregar o painel agora. A operação de pagamentos continua independente desta tela.</p><Button type="button" className="mt-6" onClick={reset}><FiRefreshCw />Tentar novamente</Button></div></div>;
}
