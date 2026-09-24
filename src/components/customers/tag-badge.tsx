import type { CustomerTag } from "@/generated/prisma/enums";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { TAG_LABELS } from "@/server/customers/stats";

const VARIANT: Record<CustomerTag, BadgeProps["variant"]> = {
  NEW: "neutral",
  LOYAL: "success",
  INACTIVE: "warning",
};

export function TagBadge({ tag }: { tag: CustomerTag }) {
  return <Badge variant={VARIANT[tag]}>{TAG_LABELS[tag]}</Badge>;
}
