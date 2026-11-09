import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/theme/ThemeContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BlunderBot - The Robot That Plays Chess",
  description: "Outsmarted by a machine? Play with BlunderBot — your chess nemesis. Play. Analyze. Improve. Or just survive.",
  keywords: ["chess", "stockfish", "chess bot", "ai chess", "gaming", "blunderbot"],
  authors: [{ name: "AbhishekDvs" }],
  icons: {
    icon: "/favicon.ico",
  },
  metadataBase: new URL("https://blunderbot.pages.dev/"),
  openGraph: {
    title: "BlunderBot - The Robot That Plays Chess",
    description: "Outsmarted by a machine? Play with BlunderBot — your chess nemesis. Play. Analyze. Improve. Or just survive.",
    url: "https://blunderbot.pages.dev/",
    siteName: "BlunderBot",
    images: [
      {
        url: "https://blunderbot.pages.dev/og-image.png",
        width: 1200,
        height: 630,
        alt: "BlunderBot Chess",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BlunderBot - Chess Bot",
    description: "BlunderBot - Your Chess Nemesis. Choose a difficulty. Get humbled.",
    images: ["https://blunderbot.pages.dev/og-image.png"],
    creator: "@AbhisheksDistro", 
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-[#0A0D12] text-[#F5F6F8] antialiased selection:bg-[#DDAA57]/30 selection:text-[#DDAA57]`}>
        <ThemeProvider>
          <div className="min-h-screen flex flex-col justify-between">
            <div className="flex-1 flex flex-col">{children}</div>

            <footer className="w-full border-t border-[#202832] bg-[#0C0F14] text-center text-xs text-[#84919D] py-4 sm:py-5">
              <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-[#F5F6F8]">BlunderBot</span>
                  <span className="text-[#2D3847]">•</span>
                  <span>Pure Client-Side Stockfish 16 WASM</span>
                  <span className="text-[#2D3847]">•</span>
                  <span className="text-[#438A69] font-mono">0ms Telemetry</span>
                </div>
                <div>
                  Crafted by&nbsp;
                  <a
                    href="https://abhisdistro.pages.dev/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#DDAA57] font-semibold hover:underline transition duration-150"
                  >
                    Abhishek Dvs
                  </a>
                </div>
              </div>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>    
  );
}
