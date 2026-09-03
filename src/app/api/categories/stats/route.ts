import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const DEFAULT_CATEGORY_METAS: Record<string, { icon: string; color: string; defaultBudget: number }> = {
    "Housing & Util": { icon: "home", color: "#E5A93C", defaultBudget: 2500 },
    "Food & Dining": { icon: "utensils", color: "#0F5C53", defaultBudget: 1000 },
    "Transportation": { icon: "car", color: "#4EA89B", defaultBudget: 400 },
    "Subscriptions": { icon: "tv", color: "#54B5A6", defaultBudget: 150 },
    "Shopping": { icon: "shopping-bag", color: "#C94A29", defaultBudget: 500 },
    "Bills & Utilities": { icon: "zap", color: "#E5A93C", defaultBudget: 800 },
    "Rent": { icon: "home", color: "#E5A93C", defaultBudget: 2000 },
    "Entertainment": { icon: "film", color: "#7B61FF", defaultBudget: 300 },
    "Health": { icon: "activity", color: "#1E7D46", defaultBudget: 300 },
    "Education": { icon: "book-open", color: "#0F5C53", defaultBudget: 400 },
};

const PALETTE = ["#E5A93C", "#0F5C53", "#4EA89B", "#C94A29", "#7B61FF", "#54B5A6", "#1E7D46", "#D97706"];

export async function GET() {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthName = now.toLocaleString("default", { month: "long" });

    // Fetch personal expenses, shared splits, and user categories in parallel
    const [personalExpenses, mySplits, userCategories] = await Promise.all([
        prisma.expense.findMany({
            where: {
                ownerId: user.id,
                date: { gte: startOfMonth, lte: endOfMonth },
            },
        }),
        user.selfPersonId
            ? prisma.expenseSplit.findMany({
                  where: {
                      personId: user.selfPersonId,
                      expense: {
                          workspace: { ownerId: user.id },
                          date: { gte: startOfMonth, lte: endOfMonth },
                      },
                  },
                  include: { expense: true },
              })
            : Promise.resolve([]),
        prisma.category.findMany({
            where: { ownerId: user.id },
        }),
    ]);

    // Map custom categories by name
    const categoryMap = new Map(userCategories.map((c) => [c.name.toLowerCase(), c]));

    // Aggregate spending by category
    const spentByCategory: Record<string, { total: number; count: number }> = {};

    for (const exp of personalExpenses) {
        const cat = exp.category?.trim() || "Other";
        if (!spentByCategory[cat]) spentByCategory[cat] = { total: 0, count: 0 };
        spentByCategory[cat].total += Number(exp.amount);
        spentByCategory[cat].count += 1;
    }

    for (const split of mySplits) {
        const cat = split.expense.category?.trim() || "Shared";
        if (!spentByCategory[cat]) spentByCategory[cat] = { total: 0, count: 0 };
        spentByCategory[cat].total += Number(split.shareAmount);
        spentByCategory[cat].count += 1;
    }

    // Collect all distinct category names
    const allCategoryNames = new Set([
        ...Object.keys(DEFAULT_CATEGORY_METAS),
        ...userCategories.map((c) => c.name),
        ...Object.keys(spentByCategory),
    ]);

    const categoriesList = Array.from(allCategoryNames).map((name, index) => {
        const meta = DEFAULT_CATEGORY_METAS[name] || {};
        const userCat = categoryMap.get(name.toLowerCase());
        const spentData = spentByCategory[name] ?? { total: 0, count: 0 };

        const budget = userCat?.budget
            ? Number(userCat.budget)
            : meta.defaultBudget ?? 1000;

        const color = userCat?.color || meta.color || PALETTE[index % PALETTE.length];
        const icon = userCat?.icon || meta.icon || "tag";
        const spent = Math.round(spentData.total * 100) / 100;
        const utilizedPercent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
        const isOverBudget = spent > budget;

        return {
            id: userCat?.id || `def-${index}`,
            name,
            spent,
            budget,
            utilizedPercent,
            isOverBudget,
            color,
            icon,
            count: spentData.count,
        };
    });

    // Sort categories: categories with spending first, then alphabetically
    categoriesList.sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name));

    const totalSpent = Math.round(
        Object.values(spentByCategory).reduce((sum, item) => sum + item.total, 0) * 100
    ) / 100;

    // Build allocation chart slices
    const allocation = categoriesList
        .filter((c) => c.spent > 0)
        .map((c) => ({
            name: c.name,
            value: c.spent,
            percentage: totalSpent > 0 ? Math.round((c.spent / totalSpent) * 100) : 0,
            color: c.color,
        }));

    return NextResponse.json({
        monthName,
        totalSpent,
        categories: categoriesList,
        allocation,
    });
}
