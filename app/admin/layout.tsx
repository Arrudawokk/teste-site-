import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Operações",
  description: "Painel administrativo protegido da EscalaHub.",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
