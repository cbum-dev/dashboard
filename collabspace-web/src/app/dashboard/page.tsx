"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMe, type AuthUser } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const accessToken =
        typeof window !== "undefined"
          ? window.localStorage.getItem("accessToken")
          : null;
      if (!accessToken) {
        router.replace("/login");
        return;
      }
      try {
        const me = await fetchMe(accessToken);
        if (!me) {
          router.replace("/login");
          return;
        }
        setUser(me);
      } catch {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  function handleLogout() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("accessToken");
      window.localStorage.removeItem("refreshToken");
    }
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-sm text-zinc-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold">CollabSpace</h1>
        <div className="flex items-center gap-3 text-sm text-zinc-700">
          {user && <span>{user.name}</span>}
          <button
            onClick={handleLogout}
            className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h2 className="mb-2 text-xl font-semibold">Welcome to your workspace</h2>
        <p className="mb-4 text-sm text-zinc-600">
          Next steps: workspace list, documents, real-time editor, and version history UI will appear here.
        </p>
      </main>
    </div>
  );
}
