import type { MetadataRoute } from "next";

// Lets sellers "add to home screen" with the Ghaltak icon and name.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "غلتک",
    short_name: "غلتک",
    description: "مدیریت سفارش، موجودی و فروش برای فروشگاه‌های آنلاین",
    lang: "fa",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    background_color: "#0c1326",
    theme_color: "#0c1326",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
