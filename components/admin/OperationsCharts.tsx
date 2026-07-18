"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SalesPoint } from "@/lib/admin/types";
import { formatCurrency } from "@/lib/admin/format";

function chartData(points: SalesPoint[]) {
  return points.map((point) => ({ ...point, label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(point.date)) }));
}

const tooltipStyle = { background: "#0b1018", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, color: "#fff", boxShadow: "0 18px 50px rgba(0,0,0,.35)" };

export function RevenueChart({ points }: { points: SalesPoint[] }) {
  return <div className="h-80 w-full" aria-label="Gráfico de receita e vendas"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData(points)} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}><defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60a5fa" stopOpacity={0.32} /><stop offset="100%" stopColor="#60a5fa" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><XAxis dataKey="label" stroke="#747d8d" tickLine={false} axisLine={false} fontSize={11} /><YAxis stroke="#747d8d" tickLine={false} axisLine={false} fontSize={11} tickFormatter={(value: number) => `R$${Math.round(value)}`} /><Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [name === "Receita" ? formatCurrency(Number(value)) : Number(value), name]} /><Legend /><Area type="monotone" dataKey="revenue" name="Receita" stroke="#60a5fa" strokeWidth={2.5} fill="url(#revenueFill)" /><Area type="monotone" dataKey="sales" name="Vendas" stroke="#b8ff5c" strokeWidth={2} fillOpacity={0} /></AreaChart></ResponsiveContainer></div>;
}

export function OperationsChart({ points }: { points: SalesPoint[] }) {
  return <div className="h-80 w-full" aria-label="Gráfico de operação"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData(points)} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><XAxis dataKey="label" stroke="#747d8d" tickLine={false} axisLine={false} fontSize={11} /><YAxis allowDecimals={false} stroke="#747d8d" tickLine={false} axisLine={false} fontSize={11} /><Tooltip contentStyle={tooltipStyle} /><Legend /><Bar dataKey="checkouts" name="Checkouts" fill="#60a5fa" radius={[5, 5, 0, 0]} /><Bar dataKey="abandoned" name="Abandonos" fill="#f59e0b" radius={[5, 5, 0, 0]} /><Bar dataKey="downloads" name="Downloads" fill="#b8ff5c" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>;
}
