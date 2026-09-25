import type { MetadataRoute } from "next";

// Lets sellers "add to home screen" with the Ghaltak icon and name.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "غلتک",
    short_name: "غلتک",
    description: "پلتفرم مدیریت فروشندگان آنلاین",
    lang: "fa",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
