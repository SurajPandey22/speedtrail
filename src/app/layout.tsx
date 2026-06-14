import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import Nav from "@/components/Nav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SpeedTrail — Flatmate Expense Tracker",
  description: "Track shared flat expenses with smart CSV import, debt simplification, and per-member breakdowns.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex" }}>
            <Nav />
            <main style={{ flex: 1, padding: "32px 40px", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
              {children}
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
