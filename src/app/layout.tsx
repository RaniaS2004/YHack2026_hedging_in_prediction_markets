import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HedgeKit — One-Click Hedging For Market And Real-World Risk",
  description:
    "Hedge prediction market exposure and real-world risk in one place. Discover hedges, compare payoff impact, and execute multi-leg protection in one click.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${geistMono.variable} h-full antialiased`}
    >
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
                Arbitrage
              </Link>
            </div>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
