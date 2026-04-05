import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { signOut } from "@/src/lib/auth";
import Logo from "@/src/components/ui/Logo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-bg-base">
      <nav className="bg-bg-surface/80 backdrop-blur border-b border-border px-6 py-0 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16">
          <a href="/dashboard" className="flex items-center gap-3">
            <Logo height={24} />
          </a>
          <div className="flex items-center gap-5">
            <span className="text-text-secondary text-sm hidden md:block">{session.user.email}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="text-text-secondary hover:text-text-primary text-sm h-10 px-4 rounded-lg hover:bg-bg-elevated transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
