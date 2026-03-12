import type { Metadata } from "next";
import Script from "next/script";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "RedEngine",
  description: "Mine Reddit communities for pain points, trends, and hidden signals",
  icons: {
    icon: "/logo.png",
  },
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0B0B0F] text-[#E6E6EB]">
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-5633NLTG');`}
        </Script>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-5633NLTG"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 h-12 bg-[#0B0B0F]/80 backdrop-blur-md border-b border-[#2A2A33]">
          <div className="flex items-center gap-3">
            <div id="header-hamburger" className="lg:hidden w-12 h-12 shrink-0"></div>
            <a href="/" className="text-base font-bold tracking-tight">
              <span className="mr-1">🔴</span>
              <span className="bg-gradient-to-r from-[#FF3B3B] to-[#FF5555] bg-clip-text text-transparent">RedEngine</span>
            </a>
          </div>
          <a
            href="https://upengine.app/portfolio/redengine/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#A1A1AA] hover:text-[#E6E6EB] transition-colors"
          >
            Learn More →
          </a>
        </header>
        <div className="pt-12">
          {children}
        </div>
      </body>
    </html>
  );
}
