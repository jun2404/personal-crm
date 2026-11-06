import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Personal CRM",
    short_name: "CRM",
    description: "Everyone you've met, and when to reach out next.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2f5bb7",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
