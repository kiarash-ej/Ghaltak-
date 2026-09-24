import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "./session";

export type CurrentSeller = { id: string; name: string; mobile: string };

/**
 * Returns the logged-in seller or redirects to /login.
 *
 * THIS is the only trusted source of `sellerId`. Every query and mutation in
 * the app must scope by the id returned here, never by an id sent from the
 * client.
 */
export const requireSeller = cache(async (): Promise<CurrentSeller> => {
  const session = await readSession();
  if (!session) redirect("/login");

  const seller = await prisma.seller.findUnique({
    where: { id: session.sellerId },
    select: { id: true, name: true, mobile: true },
  });
  // Valid cookie for a seller that no longer exists: clear it, or /login and
  // the dashboard would redirect to each other forever.
  if (!seller) redirect("/logout");

  return seller;
});
