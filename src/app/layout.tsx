import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { LocaleProvider } from "@/components/locale-provider";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ShambaTrust | Protect Your Family's Land & Legacy",
  description:
    "Secure your shambas, title deeds, and businesses in a legally binding digital vault. Advocate-verified succession planning for Kenyan families.",
  openGraph: {
    title: "ShambaTrust | Protect Your Family's Legacy",
    description:
      "Digital estate vault and advocate-verified succession planning for Kenyan elders and families.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${sourceSans.variable}`}>
      <body className="site-shell min-h-full font-sans antialiased">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
