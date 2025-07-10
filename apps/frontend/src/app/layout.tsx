import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "BlunderBot - The Robot That Plays Chess",
  description: "Outsmarted by a machine? Play with BlunderBot — your chess nemesis. Play. Analyze. Improve. Or just survive.",
  keywords: ["chess", "stockfish", "chess bot", "ai chess", "gaming", "blunderbot"],
  authors: [{ name: "AbhishekDvs" }],
  icons: {
    icon: "/favicon.ico",
  },
  metadataBase: new URL("https://yourdomain.com"), // Replace with your actual domain
  openGraph: {
    title: "BlunderBot - The Robot That Plays Chess",
    description: "Outsmarted by a machine? Play with BlunderBot — your chess nemesis. Play. Analyze. Improve. Or just survive.",
    url: "https://yourdomain.com",
    siteName: "BlunderBot",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BlunderBot Chess App Preview",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BlunderBot - Chess Bot",
    description: "The only chess bot that mocks your every move. Choose a difficulty. Get humbled.",
    images: ["/og-image.png"],
    creator: "@AbhisheksDistro", // Optional
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} bg-[#1F1D2B] text-white antialiased`}>
          <div className="min-h-screen flex flex-col">
            <main className="flex-grow">
              {children}
            </main>

            <footer className="w-full border-t border-gray-700 bg-[#2A2937] text-center text-sm text-gray-400 py-6">
              Built with💡and coffee by&nbsp;
              <a
                href="https://abhisdistro.pages.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-400 font-medium hover:underline"
              >
                Abhishek Dvs
              </a>
            </footer>
          </div>
        </body>
      </html>

    
  );
}
