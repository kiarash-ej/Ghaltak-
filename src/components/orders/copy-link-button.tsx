"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Copies `${origin}${path}` so the seller can paste the link into a chat. */
export function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`${window.location.origin}${path}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("لینک را کپی کنید:", `${window.location.origin}${path}`);
        }
      }}
    >
      {copied ? "کپی شد" : "کپی لینک"}
    </Button>
  );
}
