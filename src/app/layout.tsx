import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HRMS Command Center",
  description: "Lead-to-delivery operations dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  );
}
