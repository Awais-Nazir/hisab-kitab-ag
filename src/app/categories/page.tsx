"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppLayout } from "@/components/AppLayout";
import { ModalPortal } from "@/components/ModalPortal";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useCurrency } from "@/context/CurrencyContext";

interface CategoryStat {
  id: string;
  name: string;
  spent: number;
  budget: number;
  utilizedPercent: number;
  isOverBudget: boolean;
  color: string;
  icon: string;
  count: number;
}

interface AllocationSlice {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

interface StatsResponse {
  monthName: string;
  totalSpent: number;
  categories: CategoryStat[];
  allocation: AllocationSlice[];
}

interface CategoryExpenseItem {
  id: string;
  amount: number | string;
  description: string;
  date: string;
  account?: { id: string; name: string; color?: string } | null;
}

function groupExpensesByDate(expenses: CategoryExpenseItem[]) {
  const groups: { dateKey: string; items: CategoryExpenseItem[] }[] = [];
  const map: Record<string, CategoryExpenseItem[]> = {};

  for (const exp of expenses) {
    const d = new Date(exp.date);
    const dateKey = d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    if (!map[dateKey]) {
      map[dateKey] = [];
      groups.push({ dateKey, items: map[dateKey] });
    }
    map[dateKey].push(exp);
  }
  return groups;
}

function CategoryIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "home":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case "utensils":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2" />
          <path d="M15 2v14a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2" />
          <path d="M9 2v20" />
        </svg>
      );
    case "car":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
          <circle cx="7" cy="17" r="2" />
          <circle cx="17" cy="17" r="2" />
        </svg>
      );
    case "shopping-bag":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
    case "tv":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect width="20" height="15" x="2" y="7" rx="2" ry="2" />
          <polyline points="17 2 12 7 7 2" />
        </svg>
      );
    case "users":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
          <circle cx="7" cy="7" r=".5" fill="currentColor" />
        </svg>
      );
  }
}

export default function CategoriesPage() {
  const { symbol } = useCurrency();
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Create Category Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatBudget, setNewCatBudget] = useState("1000");
  const [adding, setAdding] = useState(false);

  // Edit Category Modal State
  const [editingCat, setEditingCat] = useState<CategoryStat | null>(null);
  const [editName, setEditName] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Category Details (Date-wise Expenses) Modal State (Data-only: closes on click outside & Escape)
  const [selectedCatForDetails, setSelectedCatForDetails] = useState<CategoryStat | null>(null);
  const [catExpenses, setCatExpenses] = useState<CategoryExpenseItem[]>([]);
  const [loadingCatExpenses, setLoadingCatExpenses] = useState(false);

  async function handleOpenCategoryDetails(cat: CategoryStat) {
    setSelectedCatForDetails(cat);
    setLoadingCatExpenses(true);
    try {
      const targetParam = cat.id && !cat.id.startsWith("def-") ? cat.id : cat.name;
      const res = await apiFetch<{ expenses: CategoryExpenseItem[] }>(
        `/api/categories/${encodeURIComponent(targetParam)}?name=${encodeURIComponent(cat.name)}`
      );
      setCatExpenses(res.expenses || []);
    } catch {
      setCatExpenses([]);
    } finally {
      setLoadingCatExpenses(false);
    }
  }

  // Close data-only category details modal on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedCatForDetails) {
        setSelectedCatForDetails(null);
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [selectedCatForDetails]);

  async function loadData() {
    try {
      const res = await apiFetch<StatsResponse>("/api/categories/stats");
      setData(res);
    } catch {
      // Handled gracefully
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatName.trim() || adding) return;
    setAdding(true);
    try {
      await apiFetch("/api/categories", {
        method: "POST",
        body: JSON.stringify({
          name: newCatName.trim(),
          budget: parseFloat(newCatBudget) || 1000,
        }),
      });
      setNewCatName("");
      setNewCatBudget("1000");
      setIsCreateModalOpen(false);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add category");
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCat || savingEdit) return;
    const numBudget = parseFloat(editBudget);
    if (isNaN(numBudget) || numBudget <= 0) {
      alert("Please enter a valid budget amount");
      return;
    }
    const cleanName = editName.trim();
    if (!cleanName) {
      alert("Please enter a category name");
      return;
    }

    setSavingEdit(true);
    try {
      const targetParam = editingCat.id && !editingCat.id.startsWith("def-") ? editingCat.id : editingCat.name;
      await apiFetch(`/api/categories/${encodeURIComponent(targetParam)}?name=${encodeURIComponent(editingCat.name)}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: cleanName,
          budget: numBudget,
        }),
      });
      setEditingCat(null);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update category");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteCategory(cat: CategoryStat) {
    if (cat.count > 0) {
      alert(`Cannot delete "${cat.name}" because ${cat.count} expense(s) are logged under it.`);
      return;
    }
    if (!confirm(`Are you sure you want to delete category "${cat.name}"?`)) return;

    try {
      const targetParam = cat.id && !cat.id.startsWith("def-") ? cat.id : cat.name;
      await apiFetch(`/api/categories/${encodeURIComponent(targetParam)}?name=${encodeURIComponent(cat.name)}`, {
        method: "DELETE",
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              categories: prev.categories.filter(
                (c) => c.id !== cat.id && c.name.toLowerCase().trim() !== cat.name.toLowerCase().trim()
              ),
            }
          : prev
      );
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete category");
    }
  }

  return (
    <AppLayout
      title="Library"
      subtitle="Spending Categories"
      onAddEntry={() => setIsCreateModalOpen(true)}
      addEntryLabel="+ Create Category"
    >
      <div className="max-w-5xl mx-auto">
        {/* Header section matching Figma */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-[#0F5C53] dark:text-[#34D399] mb-1">
              Category Matrix
            </div>
            <h1 className="font-serif font-bold text-3xl md:text-4xl text-[#162B27] dark:text-white tracking-tight">
              Categories
            </h1>
            <p className="text-xs text-[#6B7268] dark:text-[#8E9C95] mt-1 max-w-xl">
              Manage and monitor your spending across distinct areas of your financial life. Review historical trends and current budget pacing.
            </p>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-[#0F5C53] hover:bg-[#0A3F38] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white px-5 py-2.5 rounded-2xl text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>+ Create Category</span>
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-[#6B7268] dark:text-[#8E9C95]">Loading categories & allocation...</div>
        ) : (
          <>
            {/* Top Allocation Card matching Figma Library design */}
            <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-6 sm:p-8 mb-8 shadow-xs">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex-1 w-full">
                  <span className="text-[11px] uppercase font-bold text-[#0F5C53] dark:text-[#34D399] tracking-wider">
                    Spending Breakdown
                  </span>
                  <h2 className="font-serif font-bold text-2xl text-[#162B27] dark:text-white mt-1">
                    {data?.monthName} Allocation
                  </h2>
                  <p className="text-xs text-[#6B7268] dark:text-[#8E9C95] mt-1 max-w-md">
                    Your spending distributed across major top-level categories. Hover for precise amounts and percentages.
                  </p>

                  {/* Slices list */}
                  <div className="mt-6 space-y-2.5">
                    {data?.allocation && data.allocation.length > 0 ? (
                      data.allocation.map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-xs py-1.5 border-b border-[#F4F1EA] dark:border-[#1E2824]">
                          <div className="flex items-center gap-2.5">
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="font-semibold text-[#162B27] dark:text-white">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-[#162B27] dark:text-white">
                              {symbol}{Math.round(item.value).toLocaleString()}
                            </span>
                            <span className="text-[#6B7268] dark:text-[#8E9C95] w-10 text-right font-mono">{item.percentage}%</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[#6B7268] dark:text-[#8E9C95]">No categorized spending logged for {data?.monthName} yet.</p>
                    )}
                  </div>
                </div>

                {/* Donut Pie Chart matching Figma */}
                <div className="w-64 h-64 relative flex items-center justify-center flex-shrink-0">
                  {data && data.allocation.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.allocation}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={95}
                            paddingAngle={3}
                            stroke="none"
                          >
                            {data.allocation.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => [`${symbol}${Math.round(Number(value ?? 0)).toLocaleString()}`, "Spent"]}
                            contentStyle={{
                              background: "#13191E",
                              border: "1px solid #1E2824",
                              borderRadius: "12px",
                              color: "#FFFFFF",
                              fontSize: "12px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Center total text */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-widest">
                          TOTAL
                        </span>
                        <span className="font-serif font-bold text-2xl text-[#162B27] dark:text-white">
                          {symbol}{Math.round(data.totalSpent).toLocaleString()}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="w-48 h-48 rounded-full border-4 border-dashed border-[#E5E0D8] dark:border-[#1E2824] flex flex-col items-center justify-center text-center p-4">
                      <span className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95]">TOTAL</span>
                      <span className="font-serif font-bold text-xl text-[#162B27] dark:text-white">{symbol}0</span>
                      <span className="text-[10px] text-[#6B7268] dark:text-[#8E9C95] mt-1">No data</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section Header: Categories Cards */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                Budget Pacing
              </h3>
              <span className="text-xs text-[#6B7268] dark:text-[#8E9C95]">
                {data?.categories.length} categories active
              </span>
            </div>

            {/* Category Cards Grid matching Figma */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
              {data?.categories.map((cat) => (
                <div
                  key={cat.id || cat.name}
                  onClick={() => handleOpenCategoryDetails(cat)}
                  className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-[#0F5C53]/60 dark:hover:border-[#10B981]/50 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs transition-transform group-hover:scale-105"
                        style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
                      >
                        <CategoryIcon icon={cat.icon} />
                      </div>

                      <div className="flex items-center gap-1.5">
                        {cat.isOverBudget && (
                          <span className="text-[10px] uppercase font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-900">
                            Over Budget
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCat(cat);
                            setEditName(cat.name);
                            setEditBudget(cat.budget.toString());
                          }}
                          className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-white cursor-pointer rounded-xl hover:bg-stone-100 dark:hover:bg-[#1A2229] transition-colors"
                          title="Edit Category & Budget"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                          </svg>
                        </button>
                        {cat.count === 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCategory(cat);
                            }}
                            className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            title="Delete Category"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    <h4 className="font-serif font-bold text-lg text-[#162B27] dark:text-white">
                      {cat.name}
                    </h4>
                    <p className="text-xs text-[#6B7268] dark:text-[#8E9C95] mt-0.5">
                      {cat.count} {cat.count === 1 ? "expense" : "expenses"} logged
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#F0ECE6] dark:border-[#1E2824]">
                    <div className="flex items-baseline justify-between mb-2">
                      <div>
                        <span className="text-xs text-[#6B7268] dark:text-[#8E9C95]">Spent: </span>
                        <span className="font-semibold text-[#162B27] dark:text-white">
                          {symbol}{Math.round(cat.spent).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-[#6B7268] dark:text-[#8E9C95]">
                        Budget: {symbol}{Math.round(cat.budget).toLocaleString()}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2 bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          cat.isOverBudget ? "bg-rose-500" : "bg-[#0F5C53] dark:bg-[#10B981]"
                        }`}
                        style={{ width: `${Math.min(100, cat.utilizedPercent)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[11px] font-medium text-[#6B7268] dark:text-[#8E9C95]">
                      <span>{cat.isOverBudget ? "Exceeded" : "Pacing"}</span>
                      <span className="font-mono">{cat.utilizedPercent}% utilized</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Create New Category Modal */}
            {isCreateModalOpen && (
              <ModalPortal>
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
                  <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-6 max-w-sm w-full shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                        Create Category
                      </h3>
                      <button
                        onClick={() => setIsCreateModalOpen(false)}
                        className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-white cursor-pointer text-lg font-bold"
                      >
                        ✕
                      </button>
                    </div>

                    <form onSubmit={handleAdd} className="space-y-4">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                          Category Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Groceries, Gym"
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          required
                          autoFocus
                          className="w-full text-xs bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3 py-2.5 text-[#162B27] dark:text-white placeholder:text-stone-400 focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                          Monthly Budget ({symbol})
                        </label>
                        <input
                          type="number"
                          step="1"
                          placeholder="1000"
                          value={newCatBudget}
                          onChange={(e) => setNewCatBudget(e.target.value)}
                          required
                          className="w-full text-xs bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3 py-2.5 text-[#162B27] dark:text-white placeholder:text-stone-400 focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                        />
                      </div>

                      <div className="pt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setIsCreateModalOpen(false)}
                          className="w-1/3 py-2.5 text-xs font-semibold text-[#6B7268] dark:text-[#8E9C95] hover:bg-[#FAF8F5] dark:hover:bg-[#1A2229] rounded-xl cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={adding || !newCatName.trim()}
                          className="w-2/3 bg-[#0F5C53] hover:bg-[#0A3F38] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          {adding ? "Creating..." : "+ Create Category"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </ModalPortal>
            )}

            {/* Modal to Edit Category Name & Budget */}
            {editingCat && (
              <ModalPortal>
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
                  <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-6 max-w-sm w-full shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                      Edit Category
                    </h3>
                    <button
                      onClick={() => setEditingCat(null)}
                      className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-white cursor-pointer text-lg font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSaveEdit} className="space-y-4">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                          Category Name
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          required
                          className="w-full text-xs bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3 py-2.5 text-[#162B27] dark:text-white placeholder:text-stone-400 focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                          Monthly Budget ({symbol})
                        </label>
                        <input
                          type="number"
                          step="1"
                          value={editBudget}
                          onChange={(e) => setEditBudget(e.target.value)}
                          required
                          autoFocus
                          className="w-full text-xs bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3 py-2.5 text-[#162B27] dark:text-white placeholder:text-stone-400 focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                        />
                      </div>

                      <div className="pt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingCat(null)}
                          className="w-1/3 py-2.5 text-xs font-semibold text-[#6B7268] dark:text-[#8E9C95] hover:bg-[#FAF8F5] dark:hover:bg-[#1A2229] rounded-xl cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingEdit}
                          className="w-2/3 bg-[#0F5C53] hover:bg-[#0A3F38] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          {savingEdit ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </ModalPortal>
            )}

            {/* Category Details Modal: Date-wise Expenses (Data-only: closes on click outside & Escape) */}
            {selectedCatForDetails && (
              <ModalPortal>
                <div
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setSelectedCatForDetails(null);
                  }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto"
                >
                  <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl my-auto max-h-[85vh] flex flex-col">
                  {/* Header */}
                  <div className="flex items-start justify-between pb-4 border-b border-[#F0ECE6] dark:border-[#1E2824]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#0F5C53]/10 dark:bg-emerald-500/15 text-[#0F5C53] dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <CategoryIcon icon={selectedCatForDetails.icon} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                            {selectedCatForDetails.name}
                          </h3>
                          {selectedCatForDetails.budget > 0 && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                selectedCatForDetails.spent > selectedCatForDetails.budget
                                  ? "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400"
                                  : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                              }`}
                            >
                              {selectedCatForDetails.spent > selectedCatForDetails.budget
                                ? "Over Budget"
                                : `${Math.round((selectedCatForDetails.spent / selectedCatForDetails.budget) * 100)}%`}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#6B7268] dark:text-[#8E9C95] mt-0.5">
                          Spent: <strong className="text-[#162B27] dark:text-white">{symbol}{Math.round(selectedCatForDetails.spent).toLocaleString()}</strong>
                          {selectedCatForDetails.budget > 0 && (
                            <> • Budget: <strong>{symbol}{Math.round(selectedCatForDetails.budget).toLocaleString()}</strong></>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedCatForDetails(null)}
                      className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-white rounded-lg hover:bg-stone-100 dark:hover:bg-[#1A2229] transition-colors cursor-pointer text-base font-bold"
                      aria-label="Close"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Body: Date-wise Expenses */}
                  <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
                    {loadingCatExpenses ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-2">
                        <svg className="w-6 h-6 animate-spin text-[#0F5C53] dark:text-[#34D399]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                          <path d="M12 2a10 10 0 0 1 10 10" />
                        </svg>
                        <p className="text-xs text-[#6B7268] dark:text-[#8E9C95]">Loading expenses...</p>
                      </div>
                    ) : catExpenses.length === 0 ? (
                      <div className="py-12 text-center">
                        <div className="w-12 h-12 mx-auto rounded-2xl bg-stone-100 dark:bg-[#1A2229] flex items-center justify-center text-stone-400 mb-2">
                          <CategoryIcon icon={selectedCatForDetails.icon} />
                        </div>
                        <p className="text-sm font-semibold text-[#162B27] dark:text-white">No expenses yet</p>
                        <p className="text-xs text-[#6B7268] dark:text-[#8E9C95] mt-0.5">
                          No expenses have been recorded for {selectedCatForDetails.name} this month.
                        </p>
                      </div>
                    ) : (
                      groupExpensesByDate(catExpenses).map((group) => {
                        const dayTotal = group.items.reduce(
                          (sum, item) => sum + (Number(item.amount) || 0),
                          0
                        );
                        return (
                          <div key={group.dateKey}>
                            <div className="flex items-center justify-between sticky top-0 bg-white/95 dark:bg-[#13191E]/95 backdrop-blur-xs py-1.5 z-10 border-b border-[#F0ECE6] dark:border-[#1E2824] mb-2">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7268] dark:text-[#8E9C95]">
                                {group.dateKey}
                              </span>
                              <span className="text-[11px] font-semibold text-[#162B27] dark:text-stone-300">
                                Total: {symbol}{Math.round(dayTotal).toLocaleString()}
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              {group.items.map((exp) => (
                                <div
                                  key={exp.id}
                                  className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FAF8F5] dark:bg-[#19201D] border border-[#E5E0D8]/60 dark:border-[#28332E]/60 hover:border-[#0F5C53]/30 dark:hover:border-[#10B981]/30 transition-colors"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-7 h-7 rounded-lg bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#28332E] flex items-center justify-center text-[#0F5C53] dark:text-[#10B981] flex-shrink-0">
                                      <CategoryIcon icon={selectedCatForDetails.icon} />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-[#162B27] dark:text-white truncate">
                                        {exp.description || selectedCatForDetails.name}
                                      </p>
                                      {exp.account && (
                                        <p className="text-[10px] text-[#6B7268] dark:text-[#8E9C95] truncate">
                                          Paid via {exp.account.name}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0 pl-2">
                                    <span className="font-serif font-bold text-xs text-[#162B27] dark:text-white">
                                      -{symbol}{Math.round(Number(exp.amount)).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </ModalPortal>
          )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
