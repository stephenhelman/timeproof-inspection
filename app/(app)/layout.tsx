import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { signOut } from "@/src/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-950">
      <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/dashboard" className="flex items-center gap-3">
            <div className="bg-blue-600 px-3 py-1.5 rounded-lg">
              <span className="text-white font-bold text-sm tracking-widest">TIMEPROOF</span>
            </div>
          </a>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm hidden sm:block">{session.user.email}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="text-gray-400 hover:text-white text-sm min-h-[44px] px-3"
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
