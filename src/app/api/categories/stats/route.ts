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
    "Shared": { icon: "users", color: "#0F5C53", defaultBudget: 1500 },
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
    let [personalExpenses, mySplits, userCategories] = await Promise.all([
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

    // If user has NO categories in DB at all (e.g. brand new user), seed defaults once
    if (userCategories.length === 0) {
        await prisma.category.createMany({
            data: Object.entries(DEFAULT_CATEGORY_METAS).map(([name, meta]) => ({
                ownerId: user.id,
                name,
                budget: meta.defaultBudget,
                icon: meta.icon,
                color: meta.color,
            })),
            skipDuplicates: true,
        });
        userCategories = await prisma.category.findMany({
            where: { ownerId: user.id },
        });
    }

    // Build category spending totals
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

    // Build a map of user categories already present in database
    const existingNameMap = new Map(userCategories.map((c) => [c.name.toLowerCase().trim(), c]));

    // Only ensure categories that have ACTIVE spending but are missing from DB
    const categoriesToCreate: Array<{
        ownerId: string;
        name: string;
        budget: number;
        icon: string;
        color: string;
    }> = [];

    for (const catName of Object.keys(spentByCategory)) {
        const trimmed = catName.trim();
        if (!trimmed) continue;
        const lower = trimmed.toLowerCase();
        if (!existingNameMap.has(lower)) {
            const meta = DEFAULT_CATEGORY_METAS[trimmed] || {};
            categoriesToCreate.push({
                ownerId: user.id,
                name: trimmed,
                budget: meta.defaultBudget ?? 1000,
                icon: meta.icon || "tag",
                color: meta.color || PALETTE[categoriesToCreate.length % PALETTE.length],
            });
            existingNameMap.set(lower, null as any);
        }
    }

    // Bulk create missing spending categories if any
    if (categoriesToCreate.length > 0) {
        await prisma.category.createMany({
            data: categoriesToCreate,
            skipDuplicates: true,
        });
        // Reload all categories from DB
        userCategories = await prisma.category.findMany({
            where: { ownerId: user.id },
        });
    }

    // Map each real database category to its stats
    const categoriesList = userCategories.map((userCat, index) => {
        const meta = DEFAULT_CATEGORY_METAS[userCat.name] || {};
        
        // Sum spending matching this category case-insensitively
        let spentData = { total: 0, count: 0 };
        for (const [k, v] of Object.entries(spentByCategory)) {
            if (k.toLowerCase().trim() === userCat.name.toLowerCase().trim()) {
                spentData = {
                    total: spentData.total + v.total,
                    count: spentData.count + v.count,
                };
            }
        }

        const budget = userCat?.budget ? Number(userCat.budget) : meta.defaultBudget ?? 1000;
        const color = userCat?.color || meta.color || PALETTE[index % PALETTE.length];
        const icon = userCat?.icon || meta.icon || "tag";
        const spent = Math.round(spentData.total * 100) / 100;
        const utilizedPercent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
        const isOverBudget = spent > budget;

        return {
            id: userCat.id,
            name: userCat.name,
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
