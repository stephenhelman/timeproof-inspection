import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { signOut } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import Image from "next/image";
import {
  ClipboardList,
  Users,
  CalendarDays,
  ClipboardCheck,
  // PhoneCall,  // PRESERVED — not active in Qntum build (revival)
  CreditCard,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import DoorApproachButton from "@/src/components/door-approach/DoorApproachButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const initials =
    session.user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "??";

  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { profileImageUrl: true, role: true, isActive: true },
  });

  // PRESERVED — not active in Qntum build (revival queue)
  // const revivalCount = await prisma.lead.count({
  //   where: {
  //     status: "REVIVAL_PENDING",
  //     ...(dbUser.role === "REP" ? { assignedUserId: session.user.id } : {}),
  //   },
  // });

  const cardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/card/${session.user.id}`;

  const isAdmin = dbUser.role === "ADMIN" || dbUser.role === "REGIONAL";

  const pendingTaskCount = await prisma.task.count({
    where: {
      status: "PENDING",
      ...(isAdmin ? {} : { assignedUserId: session.user.id }),
    },
  });

  const navLinks = [
    { href: "/inspections", label: "Inspections", icon: ClipboardList, badge: null as number | null },
    { href: "/leads", label: "Leads", icon: Users, badge: null },
    { href: "/calendar", label: "Calendar", icon: CalendarDays, badge: null },
    { href: "/tasks", label: "Tasks", icon: ClipboardCheck, badge: pendingTaskCount > 0 ? pendingTaskCount : null },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: ShieldCheck, badge: null }] : []),
  ];

  return (
    <div className="min-h-screen bg-bg-base">
      <nav className="bg-bg-surface/90 backdrop-blur border-b border-border sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14 gap-4">
          {/* Logo → home */}
          <a href="/dashboard" className="flex items-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/qntum-logo.svg" alt="Qntum Roofing" height={32} style={{ height: "32px", width: "auto" }} />
          </a>

          {/* Desktop centre nav */}
          <div className="hidden md:flex items-center gap-1 flex-1">
            {navLinks.map(({ href, label, icon: Icon, badge }) => (
              <a
                key={href}
                href={href}
                className="relative flex items-center gap-1.5 text-text-secondary hover:text-text-primary text-sm px-3 py-2 rounded-lg hover:bg-bg-elevated transition-colors"
              >
                <Icon size={15} strokeWidth={1.75} />
                {label}
                {badge !== null && badge !== undefined && badge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 flex items-center justify-center bg-brand-blue text-white text-[10px] font-bold rounded-full px-1">
                    {badge}
                  </span>
                )}
              </a>
            ))}
            {/* PRESERVED — not active in Qntum build (revival nav link)
            <a href="/revival" ...>
              <PhoneCall size={15} strokeWidth={1.75} />
              Revival ...
            </a>
            */}
            <DoorApproachButton />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* View Card */}
            <a
              href={cardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-text-secondary hover:text-text-primary text-sm px-3 py-2 rounded-lg hover:bg-bg-elevated transition-colors border border-border hover:border-border-hover"
              title="View your business card"
            >
              <CreditCard size={14} strokeWidth={1.75} />
              <span className="hidden lg:inline">View Card</span>
            </a>

            {/* Settings */}
            <a
              href="/settings"
              className="w-8 h-8 rounded-full bg-brand-blue flex items-center justify-center text-white text-xs font-bold hover:bg-accent-blue-hover transition-colors shrink-0 overflow-hidden"
              title="Settings"
            >
              {dbUser.profileImageUrl ? (
                <Image
                  src={dbUser.profileImageUrl}
                  alt={initials}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                />
              ) : (
                initials
              )}
            </a>

            {/* Sign out */}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                title="Sign out"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
              >
                <LogOut size={15} strokeWidth={1.75} />
              </button>
            </form>
          </div>
        </div>

        {/* Mobile second row */}
        <div className="md:hidden flex border-t border-border overflow-x-auto">
          {navLinks.map(({ href, label, icon: Icon, badge }) => (
            <a
              key={href}
              href={href}
              className="relative flex items-center gap-1.5 shrink-0 text-text-secondary hover:text-text-primary text-sm px-4 py-2.5 transition-colors"
            >
              <Icon size={14} strokeWidth={1.75} />
              {label}
              {badge !== null && badge !== undefined && badge > 0 && (
                <span className="absolute top-1 right-1 min-w-4 h-4 flex items-center justify-center bg-brand-blue text-white text-[10px] font-bold rounded-full px-0.5">
                  {badge}
                </span>
              )}
            </a>
          ))}
          {/* PRESERVED — not active in Qntum build (revival mobile nav link) */}
          <a
            href={cardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 shrink-0 text-text-secondary hover:text-text-primary text-sm px-4 py-2.5 transition-colors"
          >
            <CreditCard size={14} strokeWidth={1.75} />
            Card
          </a>
          <DoorApproachButton mobile />
        </div>
      </nav>

      <main>{children}</main>
    </div>
  );
}
