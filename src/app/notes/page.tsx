"use client";

import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ModalPortal } from "@/components/ModalPortal";
import { apiFetch } from "@/lib/api";

interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  color: string;
  isPinned: boolean;
  date: string;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  "All",
  "General",
  "Financial",
  "Reminder",
  "Agreement",
  "Checklist",
  "Personal",
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; dot: string; darkBg: string }> = {
  emerald: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/25",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
    darkBg: "dark:bg-emerald-950/30",
  },
  amber: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/25",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
    darkBg: "dark:bg-amber-950/30",
  },
  blue: {
    bg: "bg-sky-500/10",
    border: "border-sky-500/25",
    text: "text-sky-700 dark:text-sky-400",
    dot: "bg-sky-500",
    darkBg: "dark:bg-sky-950/30",
  },
  purple: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/25",
    text: "text-purple-700 dark:text-purple-400",
    dot: "bg-purple-500",
    darkBg: "dark:bg-purple-950/30",
  },
  rose: {
    bg: "bg-rose-500/10",
    border: "border-rose-500/25",
    text: "text-rose-700 dark:text-rose-400",
    dot: "bg-rose-500",
    darkBg: "dark:bg-rose-950/30",
  },
  slate: {
    bg: "bg-stone-500/10",
    border: "border-stone-500/25",
    text: "text-stone-700 dark:text-stone-300",
    dot: "bg-stone-500",
    darkBg: "dark:bg-stone-900/40",
  },
};

function formatDayLabel(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((today - target) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { title: "Today", tag: "TODAY" };
  if (diffDays === 1) return { title: "Yesterday", tag: "YESTERDAY" };

  const formatted = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });

  return { title: formatted, tag: null };
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // State for collapsible day sections (keys are date strings)
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});

  // State for collapsible note titles (keys are note IDs)
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState("General");
  const [formColor, setFormColor] = useState("emerald");
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function fetchNotes() {
    try {
      setLoading(true);
      const res = await apiFetch<{ notes: Note[] }>("/api/notes");
      setNotes(res.notes || []);
    } catch (err) {
      console.error("Failed to load notes:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNotes();
  }, []);

  function handleOpenCreate() {
    setEditingNote(null);
    setFormTitle("");
    setFormContent("");
    setFormCategory("General");
    setFormColor("emerald");
    setFormIsPinned(false);
    setFormDate(new Date().toISOString().slice(0, 10));
    setModalOpen(true);
  }

  function handleOpenEdit(note: Note) {
    setEditingNote(note);
    setFormTitle(note.title);
    setFormContent(note.content);
    setFormCategory(note.category || "General");
    setFormColor(note.color || "emerald");
    setFormIsPinned(note.isPinned);
    setFormDate(note.date ? new Date(note.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setModalOpen(true);
  }

  async function handleSubmitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) return;

    setSubmitting(true);
    try {
      if (editingNote) {
        // Update existing note
        const res = await apiFetch<{ note: Note }>(`/api/notes/${editingNote.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: formTitle.trim(),
            content: formContent.trim(),
            category: formCategory,
            color: formColor,
            isPinned: formIsPinned,
            date: formDate,
          }),
        });
        setNotes((prev) => prev.map((n) => (n.id === res.note.id ? res.note : n)));
      } else {
        // Create new note
        const res = await apiFetch<{ note: Note }>("/api/notes", {
          method: "POST",
          body: JSON.stringify({
            title: formTitle.trim(),
            content: formContent.trim(),
            category: formCategory,
            color: formColor,
            isPinned: formIsPinned,
            date: formDate,
          }),
        });
        setNotes((prev) => [res.note, ...prev]);
        // Auto-expand the newly created note
        setExpandedNotes((prev) => ({ ...prev, [res.note.id]: true }));
      }
      setModalOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteNote(id: string, title: string) {
    if (!confirm(`Are you sure you want to delete note "${title}"?`)) return;
    try {
      await apiFetch(`/api/notes/${id}`, { method: "DELETE" });
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete note");
    }
  }

  async function handleTogglePin(note: Note, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const updatedPinned = !note.isPinned;
      const res = await apiFetch<{ note: Note }>(`/api/notes/${note.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPinned: updatedPinned }),
      });
      setNotes((prev) => prev.map((n) => (n.id === note.id ? res.note : n)));
    } catch (err) {
      console.error("Failed to toggle pin:", err);
    }
  }

  function handleCopyNote(note: Note, e: React.MouseEvent) {
    e.stopPropagation();
    const fullText = `${note.title}\n\n${note.content}`;
    navigator.clipboard.writeText(fullText);
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function toggleDayCollapse(dayKey: string) {
    setCollapsedDays((prev) => ({ ...prev, [dayKey]: !prev[dayKey] }));
  }

  function toggleNoteExpand(noteId: string) {
    setExpandedNotes((prev) => ({ ...prev, [noteId]: !prev[noteId] }));
  }

  // Filtered notes
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (selectedCategory !== "All" && n.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = n.title.toLowerCase().includes(q);
        const matchesContent = n.content.toLowerCase().includes(q);
        const matchesCat = n.category.toLowerCase().includes(q);
        return matchesTitle || matchesContent || matchesCat;
      }
      return true;
    });
  }, [notes, selectedCategory, searchQuery]);

  // Pinned notes
  const pinnedNotes = useMemo(() => {
    return filteredNotes.filter((n) => n.isPinned);
  }, [filteredNotes]);

  // Grouped by day
  const dayGroups = useMemo(() => {
    const map: Record<string, Note[]> = {};
    for (const note of filteredNotes) {
      const dateStr = note.date ? new Date(note.date).toISOString().slice(0, 10) : new Date(note.createdAt).toISOString().slice(0, 10);
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(note);
    }

    return Object.keys(map)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((dateStr) => ({
        dateStr,
        notes: map[dateStr],
      }));
  }, [filteredNotes]);

  return (
    <AppLayout
      title="Notes & Memorandums"
      subtitle="Financial agreements, reminders & records"
      addEntryLabel="+ New Note"
      onAddEntry={handleOpenCreate}
    >
      <div className="space-y-6 max-w-5xl mx-auto pb-16">
        {/* Luxury Hero Banner */}
        <div className="bg-[#0B3B36] dark:bg-[#092823] text-white border border-[#145C50] dark:border-[#134D41] rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-200 text-xs font-semibold mb-2">
                <span>📝 Personal Ledger Notes</span>
                <span>•</span>
                <span>{notes.length} Total Saved</span>
              </div>
              <h1 className="font-serif font-bold text-2xl md:text-3xl tracking-tight">
                Notes & Agreements
              </h1>
              <p className="text-emerald-100/80 text-xs md:text-sm mt-1 max-w-xl">
                Jot down commitments, return dates, payment terms, or checklist reminders. Everything is organized by day and searchable.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleOpenCreate}
                className="bg-white hover:bg-stone-100 text-[#0B3B36] font-bold text-xs px-5 py-3 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-2 active:scale-95"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span>Write Note</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes by title, keywords or agreements..."
                className="w-full pl-10 pr-10 py-2.5 bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-2xl text-xs text-[#162B27] dark:text-white placeholder:text-stone-400 focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Note counts */}
            <div className="flex items-center gap-2 text-xs text-[#6B7268] dark:text-[#8E9C95] flex-shrink-0">
              <span className="font-semibold text-[#162B27] dark:text-white">{filteredNotes.length}</span>
              <span>notes matching</span>
              {pinnedNotes.length > 0 && (
                <>
                  <span>•</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">📌 {pinnedNotes.length} pinned</span>
                </>
              )}
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? "bg-[#0F5C53] text-white shadow-xs"
                      : "bg-[#FAF8F5] dark:bg-[#1A2229] text-[#5A6863] dark:text-[#8E9C95] hover:bg-stone-200/60 dark:hover:bg-[#25303B] border border-[#E5E0D8] dark:border-[#1E2824]"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pinned Notes Showcase (if any exist) */}
        {pinnedNotes.length > 0 && !searchQuery && selectedCategory === "All" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="text-amber-500">📌</span>
              <h2 className="font-serif font-bold text-sm text-[#162B27] dark:text-white uppercase tracking-wider">
                Pinned Memorandums
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {pinnedNotes.map((note) => {
                const colorConfig = COLOR_MAP[note.color] || COLOR_MAP.emerald;
                const isExpanded = Boolean(expandedNotes[note.id]);

                return (
                  <div
                    key={`pinned-${note.id}`}
                    className={`bg-white dark:bg-[#13191E] border ${colorConfig.border} rounded-2xl p-4 shadow-xs relative overflow-hidden transition-all hover:shadow-md`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full ${colorConfig.dot} flex-shrink-0`} />
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${colorConfig.bg} ${colorConfig.text} ${colorConfig.darkBg}`}>
                          {note.category}
                        </span>
                        <h3
                          onClick={() => toggleNoteExpand(note.id)}
                          className="font-semibold text-sm text-[#162B27] dark:text-white truncate cursor-pointer hover:underline"
                        >
                          {note.title}
                        </h3>
                      </div>

                      {/* Header Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleCopyNote(note, e)}
                          title="Copy note text"
                          className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                        >
                          {copiedId === note.id ? (
                            <span className="text-[10px] text-emerald-600 font-bold">✓ Copied</span>
                          ) : (
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                            </svg>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleTogglePin(note, e)}
                          title="Unpin note"
                          className="p-1 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                        >
                          📌
                        </button>
                      </div>
                    </div>

                    {/* Content preview or expanded */}
                    <div
                      onClick={() => toggleNoteExpand(note.id)}
                      className="mt-2.5 cursor-pointer text-xs text-[#5A6863] dark:text-[#9AA5A0] leading-relaxed select-text"
                    >
                      {isExpanded ? (
                        <div className="whitespace-pre-wrap font-sans space-y-1">
                          {note.content}
                        </div>
                      ) : (
                        <p className="line-clamp-2">
                          {note.content}
                        </p>
                      )}
                    </div>

                    {/* Bottom toolbar */}
                    <div className="mt-3 pt-2.5 border-t border-[#F0ECE6] dark:border-[#1E2824] flex items-center justify-between text-[11px] text-[#8E9C95]">
                      <span>{new Date(note.date || note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(note)}
                          className="text-[#0F5C53] dark:text-[#10B981] font-semibold hover:underline cursor-pointer"
                        >
                          Edit
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id, note.title)}
                          className="text-rose-600 dark:text-rose-400 font-semibold hover:underline cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="p-12 text-center text-sm text-[#6B7268] dark:text-[#8E9C95]">
            <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p>Loading your notes journal...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredNotes.length === 0 && (
          <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-12 text-center shadow-xs">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] flex items-center justify-center text-2xl mb-4 text-[#0F5C53] dark:text-[#10B981]">
              📝
            </div>
            <h3 className="font-serif font-bold text-lg text-[#162B27] dark:text-white">
              {searchQuery ? "No matching notes found" : "No notes logged yet"}
            </h3>
            <p className="text-xs text-[#6B7268] dark:text-[#8E9C95] mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No notes match "${searchQuery}". Try clearing search or choosing another category.`
                : "Capture agreements, payment deadlines, or personal expense checklists here."}
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-5 bg-[#0F5C53] hover:bg-[#0C4A43] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              + Create First Note
            </button>
          </div>
        )}

        {/* Day-Wise Grouped Notes List */}
        {!loading && dayGroups.length > 0 && (
          <div className="space-y-4">
            {dayGroups.map((group) => {
              const { title, tag } = formatDayLabel(group.dateStr);
              const isDayCollapsed = Boolean(collapsedDays[group.dateStr]);

              return (
                <div
                  key={group.dateStr}
                  className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl overflow-hidden shadow-xs transition-all"
                >
                  {/* Day Header (Collapsible) */}
                  <button
                    type="button"
                    onClick={() => toggleDayCollapse(group.dateStr)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-stone-50/70 dark:hover:bg-[#182026]/50 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-lg bg-stone-100 dark:bg-[#182026] flex items-center justify-center text-xs text-stone-500 transition-transform duration-200 ${
                          isDayCollapsed ? "-rotate-90" : "rotate-0"
                        }`}
                      >
                        ▼
                      </span>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-serif font-bold text-base text-[#162B27] dark:text-white">
                            {title}
                          </span>
                          {tag && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                              {tag}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#6B7268] dark:text-[#8E9C95]">
                          {group.notes.length} {group.notes.length === 1 ? "note" : "notes"} recorded
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-semibold text-[#0F5C53] dark:text-[#10B981]">
                        {isDayCollapsed ? "Expand Day" : "Collapse"}
                      </span>
                    </div>
                  </button>

                  {/* Note Items in Day */}
                  {!isDayCollapsed && (
                    <div className="divide-y divide-[#F0ECE6] dark:divide-[#1E2824] border-t border-[#F0ECE6] dark:border-[#1E2824]">
                      {group.notes.map((note) => {
                        const isExpanded = Boolean(expandedNotes[note.id]);
                        const colorConfig = COLOR_MAP[note.color] || COLOR_MAP.emerald;
                        const timeStr = note.createdAt ? new Date(note.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

                        return (
                          <div
                            key={note.id}
                            className="p-4 sm:p-5 hover:bg-stone-50/40 dark:hover:bg-[#182026]/30 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              {/* Left Details */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                  <span className={`w-2.5 h-2.5 rounded-full ${colorConfig.dot} flex-shrink-0`} />
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${colorConfig.bg} ${colorConfig.text} ${colorConfig.darkBg}`}>
                                    {note.category}
                                  </span>
                                  {note.isPinned && (
                                    <span className="text-xs" title="Pinned note">📌</span>
                                  )}
                                  <span className="text-[11px] text-[#8E9C95]">
                                    {timeStr}
                                  </span>
                                </div>

                                {/* Clickable Title (Title-wise Expandable) */}
                                <h3
                                  onClick={() => toggleNoteExpand(note.id)}
                                  className="font-serif font-bold text-base text-[#162B27] dark:text-white cursor-pointer hover:text-[#0F5C53] dark:hover:text-[#34D399] transition-colors flex items-center gap-1.5"
                                >
                                  <span>{note.title}</span>
                                  <svg
                                    className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                  >
                                    <polyline points="6 9 12 15 18 9" />
                                  </svg>
                                </h3>

                                {/* Body: Snippet vs Full */}
                                <div
                                  onClick={() => toggleNoteExpand(note.id)}
                                  className="mt-1.5 text-xs text-[#5A6863] dark:text-[#9AA5A0] leading-relaxed cursor-pointer"
                                >
                                  {isExpanded ? (
                                    <div className="whitespace-pre-wrap font-sans p-3 mt-2 bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl select-text">
                                      {note.content}
                                    </div>
                                  ) : (
                                    <p className="line-clamp-1 italic text-stone-500">
                                      {note.content}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-2 flex-shrink-0 pt-1">
                                <button
                                  type="button"
                                  onClick={(e) => handleCopyNote(note, e)}
                                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                                  title="Copy text to clipboard"
                                >
                                  {copiedId === note.id ? (
                                    <span className="text-[10px] text-emerald-600 font-bold">✓ Copied</span>
                                  ) : (
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                    </svg>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => handleTogglePin(note, e)}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    note.isPinned
                                      ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                      : "text-stone-400 hover:text-amber-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                                  }`}
                                  title={note.isPinned ? "Unpin note" : "Pin note to top"}
                                >
                                  📌
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(note)}
                                  className="p-1.5 rounded-lg text-stone-400 hover:text-[#0F5C53] dark:hover:text-[#10B981] hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                                  title="Edit note"
                                >
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                  </svg>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteNote(note.id, note.title)}
                                  className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                                  title="Delete note"
                                >
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Note Modal */}
      {modalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#F0ECE6] dark:border-[#1E2824]">
                <div>
                  <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                    {editingNote ? "Edit Note" : "New Note"}
                  </h3>
                  <p className="text-xs text-[#6B7268] dark:text-[#8E9C95] mt-0.5">
                    Capture terms, personal reminders, or checklists
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitNote} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="text-[11px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                    Note Title
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Gym fee return, Loan return terms, Grocery list"
                    className="w-full text-sm font-semibold text-[#162B27] dark:text-white bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3.5 py-2.5 focus:bg-white dark:focus:bg-[#13191E] focus:outline-none focus:border-[#0F5C53]"
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="text-[11px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                    Content / Details
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="Write detailed notes, commitments, bullet points or checklists..."
                    className="w-full text-xs text-[#162B27] dark:text-white bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl p-3.5 focus:bg-white dark:focus:bg-[#13191E] focus:outline-none focus:border-[#0F5C53] leading-relaxed resize-none"
                  />
                </div>

                {/* Category & Color */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                      Category
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full text-xs bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3 py-2 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53]"
                    >
                      {CATEGORIES.filter((c) => c !== "All").map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full text-xs bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3 py-2 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53]"
                    />
                  </div>
                </div>

                {/* Color Selector & Pin Toggle */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-[11px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                      Color Tag
                    </span>
                    <div className="flex items-center gap-2">
                      {Object.keys(COLOR_MAP).map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setFormColor(col)}
                          className={`w-6 h-6 rounded-full ${COLOR_MAP[col].dot} cursor-pointer transition-transform ${
                            formColor === col ? "ring-2 ring-offset-2 ring-[#0F5C53] scale-110" : "opacity-70 hover:opacity-100"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-3">
                    <input
                      type="checkbox"
                      checked={formIsPinned}
                      onChange={(e) => setFormIsPinned(e.target.checked)}
                      className="w-4 h-4 text-[#0F5C53] rounded border-stone-300 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-[#162B27] dark:text-white flex items-center gap-1">
                      <span>Pin to Top</span>
                      <span>📌</span>
                    </span>
                  </label>
                </div>

                {/* Submit / Cancel Buttons */}
                <div className="pt-4 border-t border-[#F0ECE6] dark:border-[#1E2824] flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="w-1/3 py-2.5 text-xs font-semibold text-[#6B7268] hover:bg-[#FAF8F5] dark:hover:bg-[#1A2229] rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-2/3 bg-[#0F5C53] hover:bg-[#0A3F38] text-white py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : editingNote ? "Update Note" : "+ Save Note"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </AppLayout>
  );
}
