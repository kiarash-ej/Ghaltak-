import type { Metadata } from "next";
import { PUBLIC_THEME_INIT } from "@/lib/public-theme";
import "@fontsource-variable/vazirmatn";
import "./globals.css";

export const metadata: Metadata = {
  title: "غلتک",
  description: "مدیریت سفارش، موجودی و فروش برای فروشگاه‌های آنلاین",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fa" dir="rtl" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PUBLIC_THEME_INIT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
