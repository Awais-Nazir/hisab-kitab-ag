"use client";

import { useEffect, useState, useRef } from "react";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  function handleOpenSettings(e: React.MouseEvent, ws: Workspace) {
    e.preventDefault();
    e.stopPropagation();
    setEditingWorkspace(ws);
    setEditName(ws.name);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingWorkspace || !editName.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      const res = await apiFetch<{ workspace: Workspace }>(`/api/workspaces/${editingWorkspace.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim() }),
      });
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === editingWorkspace.id ? res.workspace : w))
      );
      setEditingWorkspace(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to rename workspace");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteWorkspace(id: string) {
    if (!confirm("Are you sure you want to permanently delete this workspace and all its expenses?")) return;
    setDeletingId(id);
    try {
      await apiFetch(`/api/workspaces/${id}`, { method: "DELETE" });
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
      setEditingWorkspace(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete workspace");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppLayout
      title="Workspaces"
      subtitle="Shared Ledgers"
      onAddEntry={() => {
        inputRef.current?.focus();
        inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
      addEntryLabel="New Workspace"
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif font-bold text-2xl md:text-3xl text-[#162B27] dark:text-white">
              Shared Workspaces
            </h1>
            <p className="text-sm text-[#5A6863] dark:text-stone-400 mt-1">
              Collaborative ledgers for trips, housemates, projects, and shared events.
            </p>
          </div>
        </div>

        {/* Create workspace card */}
        <div className="bg-white dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-2xl p-5 mb-8 shadow-xs">
          <h2 className="font-serif font-semibold text-lg text-[#162B27] dark:text-white mb-2">
            Create New Workspace
          </h2>
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
            <input
              ref={inputRef}
              type="text"
              placeholder="e.g. Roommates 2026, Goa Trip '24, Office Lunch"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              required
              disabled={creating}
              className="flex-1 px-4 py-2.5 bg-[#FAF8F5] dark:bg-[#141816] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl text-sm text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981] focus:bg-white dark:focus:bg-[#19201D]"
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
          <div className="py-12 text-center text-[#5A6863] dark:text-stone-400">Loading workspaces...</div>
        ) : workspaces.length === 0 ? (
          <div className="bg-white dark:bg-[#19201D] border border-dashed border-[#E5E0D8] dark:border-[#28332E] rounded-2xl p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-[#0F5C53]/10 text-[#0F5C53] dark:text-[#34D399] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="18" height="18" x="3" y="3" rx="3" />
                <path d="M7 8h10" />
                <circle cx="15" cy="14" r="1.5" />
              </svg>
            </div>
            <h3 className="font-serif font-semibold text-base text-[#162B27] dark:text-white">No shared workspaces yet</h3>
            <p className="text-xs text-[#5A6863] dark:text-stone-400 mt-1 max-w-sm mx-auto">
              Create your first shared workspace above to start splitting expenses with friends and roommates.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                className="group relative bg-white dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] hover:border-[#0F5C53] dark:hover:border-[#10B981] rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={(e) => handleOpenSettings(e, ws)}
                      title="Workspace Settings / Edit Name"
                      className="w-10 h-10 rounded-xl bg-[#0F5C53]/10 dark:bg-[#0F5C53]/25 text-[#0F5C53] dark:text-[#34D399] hover:bg-[#0F5C53]/20 flex items-center justify-center transition-all cursor-pointer z-10"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                    </button>
                    <Link
                      href={`/workspaces/${ws.id}`}
                      className="text-[11px] font-semibold text-[#0F5C53] dark:text-[#34D399] group-hover:translate-x-0.5 transition-transform flex items-center gap-1"
                    >
                      Open →
                    </Link>
                  </div>
                  <Link href={`/workspaces/${ws.id}`}>
                    <h3 className="font-serif font-bold text-lg text-[#162B27] dark:text-white group-hover:text-[#0F5C53] dark:group-hover:text-[#34D399] transition-colors">
                      {ws.name}
                    </h3>
                  </Link>
                </div>
                <div className="mt-4 pt-3 border-t border-[#F0ECE6] dark:border-[#28332E] flex items-center justify-between text-xs text-[#6B7268] dark:text-stone-400">
                  <span>Created</span>
                  <span>{new Date(ws.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Workspace Settings / Rename Modal */}
        {editingWorkspace && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-[#F0ECE6] dark:border-[#28332E]">
                <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                  Workspace Settings
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingWorkspace(null)}
                  className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#6B7268] dark:text-stone-400 uppercase tracking-wider block mb-1">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-[#FAF8F5] dark:bg-[#141816] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl text-sm font-semibold text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53]"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteWorkspace(editingWorkspace.id)}
                    disabled={deletingId === editingWorkspace.id}
                    className="text-rose-600 hover:text-rose-700 text-xs font-semibold hover:underline cursor-pointer disabled:opacity-50"
                  >
                    {deletingId === editingWorkspace.id ? "Deleting..." : "Delete Workspace"}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingWorkspace(null)}
                      className="px-4 py-2 text-xs font-semibold text-[#6B7268] dark:text-stone-400 hover:text-[#162B27] dark:hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingEdit || !editName.trim()}
                      className="bg-[#0F5C53] hover:bg-[#0A3F38] text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {savingEdit ? "Saving..." : "Save Name"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
