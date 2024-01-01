import type { Metadata } from "next";
import { Inter, Source_Sans_3 } from "next/font/google";
import { cn } from "~/lib/utils";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = Source_Sans_3({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Webget",
  description: "Live from the Web",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          sans.variable
        )}
      >
        {children}
      </body>
    </html>
  );
}
