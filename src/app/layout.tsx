import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "HedgeKit — Risk Copilot For Event Exposure",
  description:
    "Understand event exposure, review prediction-market hedges, compare payoff impact, and execute protection with clear real-versus-simulated disclosure.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white">
        <nav className="sticky top-0 z-50 border-b border-[#E2E8F0] bg-white/80 backdrop-blur-sm">
          <div className="mx-auto max-w-[1120px] px-6 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-[#6366F1] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 2L14 6V10L8 14L2 10V6L8 2Z" fill="white" fillOpacity="0.9"/>
                </svg>
              </div>
              <span className="text-[15px] font-semibold tracking-[-0.01em] text-[#0F172A]">
                HedgeKit
              </span>
            </Link>
            <div className="flex items-center gap-1">
              <Link
                href="/"
                className="px-3 py-1.5 text-[13px] font-medium text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] rounded-md transition-all duration-150"
              >
                Home
              </Link>
              <Link
                href="/hedge"
                className="px-3 py-1.5 text-[13px] font-medium text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] rounded-md transition-all duration-150"
              >
                Hedge
              </Link>
              <Link
                href="/portfolio"
                className="px-3 py-1.5 text-[13px] font-medium text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] rounded-md transition-all duration-150"
              >
                Portfolio
              </Link>
              <Link
                href="/arbitrage"
                className="px-3 py-1.5 text-[13px] font-medium text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] rounded-md transition-all duration-150"
              >
                Market Intelligence
              </Link>
            </div>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
