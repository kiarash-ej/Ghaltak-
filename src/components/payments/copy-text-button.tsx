"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Copies `text` (e.g. a card number without spaces) for pasting into a bank app. */
export function CopyTextButton({ text, label = "کپی" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("کپی کنید:", text);
        }
      }}
    >
      {copied ? "کپی شد" : label}
    </Button>
  );
}
