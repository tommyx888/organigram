import type { Metadata } from "next";
import { Quicksand, Space_Grotesk } from "next/font/google";

import { ClientProviders } from "@/components/i18n/client-providers";

import "./globals.css";

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
});

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Artifex Organigram",
  description:
    "Enterprise web app for visual organization charts and job description workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sk" suppressHydrationWarning>
      <body className={`${quicksand.variable} ${displayFont.variable} antialiased`}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
