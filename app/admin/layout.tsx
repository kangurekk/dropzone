import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import AdminShell from "./AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();
  if (!admin) {
    redirect("/");
  }

  return <AdminShell username={admin.username}>{children}</AdminShell>;
}