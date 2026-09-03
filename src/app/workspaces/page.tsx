"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppLayout } from "@/components/AppLayout";

interface Workspace {
  id: string;
  name: string;
  createdAt: string;
}

export default function WorkspacesPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    apiFetch<{ workspaces: Workspace[] }>("/api/workspaces")
      .then((res) => setWorkspaces(res.workspaces))
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newWorkspaceName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await apiFetch<{ workspace: Workspace }>("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: newWorkspaceName.trim() }),
      });
      setWorkspaces((prev) => [...prev, res.workspace]);
      setNewWorkspaceName("");
      router.push(`/workspaces/${res.workspace.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create workspace");
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppLayout title="Workspaces" subtitle="Shared Ledgers">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif font-bold text-2xl md:text-3xl text-[#162B27]">
              Shared Workspaces
            </h1>
            <p className="text-sm text-[#5A6863] mt-1">
              Collaborative ledgers for trips, housemates, projects, and shared events.
            </p>
          </div>
        </div>

        {/* Create workspace card */}
        <div className="bg-white border border-[#E5E0D8] rounded-2xl p-5 mb-8 shadow-xs">
          <h2 className="font-serif font-semibold text-lg text-[#162B27] mb-2">
            Create New Workspace
          </h2>
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="e.g. Roommates 2026, Goa Trip '24, Office Lunch"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              required
              disabled={creating}
              className="flex-1 px-4 py-2.5 bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl text-sm focus:outline-none focus:border-[#0F5C53] focus:bg-white"
            />
            <button
              type="submit"
              disabled={creating || !newWorkspaceName.trim()}
              className="bg-[#0F5C53] hover:bg-[#0A3F38] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              {creating ? "Creating..." : "Create Workspace +"}
            </button>
          </form>
        </div>

        {/* Workspaces list */}
        {loading ? (
          <div className="py-12 text-center text-[#5A6863]">Loading workspaces...</div>
        ) : workspaces.length === 0 ? (
          <div className="bg-white border border-dashed border-[#E5E0D8] rounded-2xl p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-[#0F5C53]/10 text-[#0F5C53] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="18" height="18" x="3" y="3" rx="3" />
                <path d="M7 8h10" />
                <circle cx="15" cy="14" r="1.5" />
              </svg>
            </div>
            <h3 className="font-serif font-semibold text-base text-[#162B27]">No shared workspaces yet</h3>
            <p className="text-xs text-[#5A6863] mt-1 max-w-sm mx-auto">
              Create your first shared workspace above to start splitting expenses with friends and roommates.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws) => (
              <Link
                key={ws.id}
                href={`/workspaces/${ws.id}`}
                className="group bg-white border border-[#E5E0D8] hover:border-[#0F5C53] rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0F5C53]/10 text-[#0F5C53] flex items-center justify-center group-hover:scale-105 transition-transform">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-semibold text-[#0F5C53] group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Open →
                    </span>
                  </div>
                  <h3 className="font-serif font-bold text-lg text-[#162B27] group-hover:text-[#0F5C53] transition-colors">
                    {ws.name}
                  </h3>
                </div>
                <div className="mt-4 pt-3 border-t border-[#F0ECE6] flex items-center justify-between text-xs text-[#6B7268]">
                  <span>Created</span>
                  <span>{new Date(ws.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
