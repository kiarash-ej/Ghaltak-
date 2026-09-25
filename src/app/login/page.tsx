import type { Metadata } from "next";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "ورود | غلتک" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <Image
        src="/brand/logo-with-name.png"
        alt="غلتک"
        width={720}
        height={337}
        priority
        className="h-auto w-60"
      />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>ورود به غلتک</CardTitle>
          <CardDescription>
            برای ورود یا ساخت حساب، شمارهٔ موبایل خود را وارد کنید.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
