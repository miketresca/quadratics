import "./globals.css";
import {Analytics} from "@vercel/analytics/next";
import type {Metadata} from "next";
import type {ReactNode} from "react";

export const metadata: Metadata = {
  title: "Quadratics",
  description: "Deterministic quadratic lesson generator"
};

export default function RootLayout({children}: {children: ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
