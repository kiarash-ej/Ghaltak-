import { redirect } from "next/navigation";

// The sales report moved into «مالی و گزارش» (finance spec §6.4); old links and bookmarks land there.
export default function ReportsPage() {
  redirect("/finance");
}
