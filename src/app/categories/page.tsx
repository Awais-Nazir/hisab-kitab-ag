"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppLayout } from "@/components/AppLayout";
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
      await apiFetch(`/api/categories/${encodeURIComponent(editingCat.id)}`, {
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
      await apiFetch(`/api/categories/${encodeURIComponent(cat.id || cat.name)}`, {
        method: "DELETE",
      });
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
      addEntryLabel="Create Category"
    >
      <div className="max-w-5xl mx-auto">
        {/* Header section matching Figma */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-[#0F5C53] dark:text-emerald-400 mb-1">
              Library
            </div>
            <h1 className="font-serif font-bold text-3xl text-[#162B27] dark:text-white tracking-tight">
              Categories
            </h1>
            <p className="text-sm text-[#5A6863] dark:text-stone-400 mt-1 max-w-xl">
              Manage and monitor your spending across distinct areas of your financial life. Review historical trends and current budget pacing.
            </p>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-[#0F5C53] hover:bg-[#0A3F38] text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>+ Create Category</span>
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[#5A6863] dark:text-stone-400">Loading categories & allocation...</div>
        ) : (
          <>
            {/* Top Allocation Card matching Figma Library design */}
            <div className="bg-white dark:bg-stone-900 border border-[#E5E0D8] dark:border-stone-800 rounded-3xl p-6 sm:p-8 mb-8 shadow-xs">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex-1 w-full">
                  <span className="text-[11px] uppercase font-bold text-[#0F5C53] dark:text-emerald-400 tracking-wider">
                    Spending Breakdown
                  </span>
                  <h2 className="font-serif font-bold text-2xl text-[#162B27] dark:text-white mt-1">
                    {data?.monthName} Allocation
                  </h2>
                  <p className="text-xs text-[#5A6863] dark:text-stone-400 mt-1 max-w-md">
                    Your spending distributed across major top-level categories. Hover for precise amounts and percentages.
                  </p>

                  {/* Slices list */}
                  <div className="mt-6 space-y-2.5">
                    {data?.allocation && data.allocation.length > 0 ? (
                      data.allocation.map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-xs py-1 border-b border-[#F4F1EA] dark:border-stone-800">
                          <div className="flex items-center gap-2.5">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="font-medium text-[#162B27] dark:text-white">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-[#162B27] dark:text-white">
                              {symbol}{item.value.toFixed(2)}
                            </span>
                            <span className="text-[#6B7268] dark:text-stone-400 w-10 text-right">{item.percentage}%</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[#6B7268] dark:text-stone-400">No categorized spending logged for {data?.monthName} yet.</p>
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
                            formatter={(value) => [`${symbol}${Number(value ?? 0).toFixed(2)}`, "Spent"]}
                            contentStyle={{
                              background: "#FFFFFF",
                              border: "1px solid #E5E0D8",
                              borderRadius: "12px",
                              fontSize: "12px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Center total text */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-widest">
                          TOTAL
                        </span>
                        <span className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                          {symbol}{data.totalSpent.toFixed(2)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="w-48 h-48 rounded-full border-4 border-dashed border-[#E5E0D8] dark:border-stone-800 flex flex-col items-center justify-center text-center p-4">
                      <span className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400">TOTAL</span>
                      <span className="font-serif font-bold text-xl text-[#162B27] dark:text-white">{symbol}0.00</span>
                      <span className="text-[10px] text-[#6B7268] dark:text-stone-400 mt-1">No data</span>
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
              <span className="text-xs text-[#5A6863] dark:text-stone-400">
                {data?.categories.length} categories active
              </span>
            </div>

            {/* Category Cards Grid matching Figma */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
              {data?.categories.map((cat) => (
                <div
                  key={cat.id || cat.name}
                  className="bg-white dark:bg-stone-900 border border-[#E5E0D8] dark:border-stone-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-[#0F5C53]/50 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                      >
                        <CategoryIcon icon={cat.icon} />
                      </div>

                      <div className="flex items-center gap-1.5">
                        {cat.isOverBudget && (
                          <span className="text-[10px] uppercase font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900">
                            Over Budget
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setEditingCat(cat);
                            setEditName(cat.name);
                            setEditBudget(cat.budget.toString());
                          }}
                          className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                          title="Edit Category & Budget"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                          </svg>
                        </button>
                        {cat.count === 0 && (
                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
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
                    <p className="text-xs text-[#6B7268] dark:text-stone-400 mt-0.5">
                      {cat.count} {cat.count === 1 ? "expense" : "expenses"} logged
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#F0ECE6] dark:border-stone-800">
                    <div className="flex items-baseline justify-between mb-2">
                      <div>
                        <span className="text-xs text-[#6B7268] dark:text-stone-400">Spent: </span>
                        <span className="font-semibold text-[#162B27] dark:text-white">
                          {symbol}{cat.spent.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-[#6B7268] dark:text-stone-400">
                        Budget: {symbol}{cat.budget}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2 bg-[#FAF8F5] dark:bg-stone-800 border border-[#E5E0D8] dark:border-stone-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          cat.isOverBudget ? "bg-rose-500" : "bg-[#0F5C53] dark:bg-emerald-500"
                        }`}
                        style={{ width: `${cat.utilizedPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[11px] font-medium text-[#6B7268] dark:text-stone-400">
                      <span>{cat.isOverBudget ? "Exceeded" : "Pacing"}</span>
                      <span>{cat.utilizedPercent}% utilized</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Create New Category Modal */}
            {isCreateModalOpen && (
              <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
                <div className="bg-white dark:bg-stone-900 border border-[#E5E0D8] dark:border-stone-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                      Create Category
                    </h3>
                    <button
                      onClick={() => setIsCreateModalOpen(false)}
                      className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleAdd} className="space-y-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">
                        Category Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Groceries, Gym"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        required
                        autoFocus
                        className="w-full text-xs bg-[#FAF8F5] dark:bg-stone-800 border border-[#E5E0D8] dark:border-stone-700 rounded-xl px-3 py-2.5 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">
                        Monthly Budget ({symbol})
                      </label>
                      <input
                        type="number"
                        step="1"
                        placeholder="1000"
                        value={newCatBudget}
                        onChange={(e) => setNewCatBudget(e.target.value)}
                        required
                        className="w-full text-xs bg-[#FAF8F5] dark:bg-stone-800 border border-[#E5E0D8] dark:border-stone-700 rounded-xl px-3 py-2.5 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53]"
                      />
                    </div>

                    <div className="pt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCreateModalOpen(false)}
                        className="w-1/3 py-2.5 text-xs font-semibold text-[#6B7268] dark:text-stone-400 hover:bg-[#FAF8F5] dark:hover:bg-stone-800 rounded-xl cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={adding || !newCatName.trim()}
                        className="w-2/3 bg-[#0F5C53] hover:bg-[#0A3F38] text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {adding ? "Creating..." : "+ Create Category"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal to Edit Category Name & Budget */}
            {editingCat && (
              <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
                <div className="bg-white dark:bg-stone-900 border border-[#E5E0D8] dark:border-stone-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                      Edit Category
                    </h3>
                    <button
                      onClick={() => setEditingCat(null)}
                      className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSaveEdit} className="space-y-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">
                        Category Name
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                        className="w-full text-xs bg-[#FAF8F5] dark:bg-stone-800 border border-[#E5E0D8] dark:border-stone-700 rounded-xl px-3 py-2.5 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">
                        Monthly Budget ({symbol})
                      </label>
                      <input
                        type="number"
                        step="1"
                        value={editBudget}
                        onChange={(e) => setEditBudget(e.target.value)}
                        required
                        autoFocus
                        className="w-full text-xs bg-[#FAF8F5] dark:bg-stone-800 border border-[#E5E0D8] dark:border-stone-700 rounded-xl px-3 py-2.5 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53]"
                      />
                    </div>

                    <div className="pt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingCat(null)}
                        className="w-1/3 py-2.5 text-xs font-semibold text-[#6B7268] dark:text-stone-400 hover:bg-[#FAF8F5] dark:hover:bg-stone-800 rounded-xl cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingEdit}
                        className="w-2/3 bg-[#0F5C53] hover:bg-[#0A3F38] text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {savingEdit ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
