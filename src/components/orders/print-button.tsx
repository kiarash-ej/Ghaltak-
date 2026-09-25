"use client";

import { Button } from "@/components/ui/button";

export function PrintButton({ label = "چاپ" }: { label?: string }) {
  return (
    <Button type="button" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
