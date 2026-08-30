import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "SmartTeaAI — Tea Price Intelligence",
  description: "AI-powered Sri Lanka tea auction price forecasting",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <head>
        <link rel="icon" href="/tea-leaf.png" type="image/png" />
      </head>
      <body className="h-full antialiased bg-[var(--cream)]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
