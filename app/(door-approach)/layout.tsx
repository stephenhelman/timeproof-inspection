import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";

export default async function DoorApproachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <>{children}</>;
}
