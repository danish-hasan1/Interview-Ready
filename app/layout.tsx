import type { Metadata } from "next";
import { Schibsted_Grotesk, Public_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const schibsted = Schibsted_Grotesk({ variable: "--font-schibsted", subsets: ["latin"], weight: ["600", "700", "800"] });
const publicSans = Public_Sans({ variable: "--font-public", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "600"] });

export const metadata: Metadata = {
  title: "Interview Ready",
  description: "Defend every line of your CV. Train on your real claims until the hard questions stop being hard.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${schibsted.variable} ${publicSans.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
