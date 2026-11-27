import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/navigation/Sidebar";
import { MobileNav } from "@/components/navigation/MobileNav";
import { Header } from "@/components/navigation/Header";
import { FloatingCountdown } from "@/components/birthday/FloatingCountdown";

export const viewport: Viewport = {
  themeColor: "#FFF8F5",
};

export const metadata: Metadata = {
  title: "House of Memories — A Private Archive",
  description: "A private digital home for shared memories.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-cream text-plum antialiased min-h-screen flex flex-col md:flex-row">
        <Sidebar />
        <div className="flex-1 flex flex-col min-h-screen pb-16 md:pb-0">
          <Header />
          <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full">
            {children}
          </main>
          <MobileNav />
          {/* Persistent Floating Birthday Countdown Widget */}
          <FloatingCountdown />
        </div>
      </body>
    </html>
  );
}
