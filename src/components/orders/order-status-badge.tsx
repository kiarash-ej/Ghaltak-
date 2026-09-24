import type { OrderStatus } from "@/generated/prisma/enums";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/server/orders/status";

const VARIANT: Record<OrderStatus, BadgeProps["variant"]> = {
  PENDING_PAYMENT: "warning",
  PAID: "neutral",
  PREPARING: "neutral",
  SHIPPED: "neutral",
  DELIVERED: "success",
  CANCELED: "danger",
  RETURNED: "danger",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={VARIANT[status]}>{STATUS_LABELS[status]}</Badge>;
}
