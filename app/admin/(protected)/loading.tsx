export default function AdminLoading() {
  return <div aria-label="Carregando painel" role="status"><div className="skeleton h-24 rounded-3xl" /><div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="skeleton h-32 rounded-3xl" />)}</div><div className="skeleton mt-6 h-96 rounded-3xl" /><span className="sr-only">Carregando dados operacionais…</span></div>;
}
