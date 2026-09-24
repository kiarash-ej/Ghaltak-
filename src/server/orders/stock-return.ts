// Pure: how much stock an order should give back, from its stock movements.

/**
 * Nets the order's movements per variant (taken is negative, already given
 * back is positive) and returns what is still out. Variants that were fully
 * given back, or never taken, are left out.
 */
export function stockToReturn(
  movements: { variantId: string; delta: number }[],
): { variantId: string; quantity: number }[] {
  const net = new Map<string, number>();
  for (const m of movements) net.set(m.variantId, (net.get(m.variantId) ?? 0) + m.delta);
  return [...net]
    .filter(([, sum]) => sum < 0)
    .map(([variantId, sum]) => ({ variantId, quantity: -sum }));
}
