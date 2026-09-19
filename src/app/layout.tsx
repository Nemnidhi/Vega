import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HRMS Command Center",
  description: "Lead-to-delivery operations dashboard.",
  // Lets iOS treat a home-screen launch as a standalone app; Android reads this
  // from the web manifest, which Next links automatically from app/manifest.ts.
  appleWebApp: { capable: true, title: "HRMS", statusBarStyle: "black-translucent" },
  icons: {
    // iOS ignores the web manifest's icons for the Home Screen and looks for this
    // one. Without it the shortcut gets a screenshot of the page instead.
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#3b82f6",
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
