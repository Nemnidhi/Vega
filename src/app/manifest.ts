import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HRMS Command Center",
    short_name: "HRMS",
    description: "Lead-to-delivery operations dashboard.",
    // Opens straight into the dashboard; the layout redirects to /admin if signed out.
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b141f",
    theme_color: "#3b82f6",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops the outer edge to the launcher's shape; this one has the
      // glyph inset into the safe zone so nothing important is cut off.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
