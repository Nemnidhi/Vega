import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vega",
  description: "Lead-to-delivery strategic operations dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  );
}
