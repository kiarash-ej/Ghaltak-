"use client";

import { Pause, Pencil, Play, Trash2 } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ExpenseForm } from "./expense-form";

// The small buttons on each expense and each monthly repeat (spec §6.4):
// edit in a sheet, remove (asks first), stop or resume a repeat.

type FormProps = ComponentProps<typeof ExpenseForm>;

export function EditButton({
  title,
  label,
  action,
  initial,
  mode,
  idPrefix,
}: {
  title: string;
  /** What is being edited, for screen readers («ویرایش تبلیغات، ۳ مهر»). */
  label: string;
  action: FormProps["action"];
  initial: FormProps["initial"];
  mode: "edit" | "repeat";
  idPrefix: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title={title}
      trigger={
        <Button type="button" variant="ghost" size="sm" aria-label={`ویرایش ${label}`} className="text-muted hover:text-ink">
          <Pencil className="size-4" aria-hidden />
        </Button>
      }
    >
      <ExpenseForm action={action} initial={initial} mode={mode} idPrefix={idPrefix} onSaved={() => setOpen(false)} />
    </Sheet>
  );
}

/** A one-button form; `confirm` asks before it runs. */
export function ActionButton({
  action,
  label,
  confirm,
  icon,
}: {
  action: () => Promise<void>;
  label: string;
  confirm?: string;
  icon: "remove" | "stop" | "resume";
}) {
  const Icon = { remove: Trash2, stop: Pause, resume: Play }[icon];
  return (
    <form action={action}>
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        aria-label={label}
        title={label}
        className={icon === "remove" ? "text-muted hover:text-danger" : "text-muted hover:text-ink"}
        onClick={(e) => {
          if (confirm && !window.confirm(confirm)) e.preventDefault();
        }}
      >
        <Icon className="size-4" aria-hidden />
      </Button>
    </form>
  );
}
