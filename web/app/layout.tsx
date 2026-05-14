import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import TabsNav from "@/components/TabsNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DeFi Stablecoin Rates Monitor",
  description: "Live lending and borrowing rates across DeFi protocols",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased overflow-x-hidden`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <TabsNav />
        {children}
      </body>
    </html>
  );
}
