import { getCachedApi, setCachedApi, addToSyncQueue } from "./idb";

// Endpoints that can be queued offline and optimistically reflected in the UI
const OFFLINE_MUTATION_ENDPOINTS = [
    "/api/expenses/personal",
    "/api/workspaces/", // e.g. /api/workspaces/[id]/expenses
    "/api/accounts",
    "/api/categories",
    "/api/udhar",
    "/api/settlements",
];

function isOfflineEligibleMutation(url: string, method?: string): boolean {
    if (!method) return false;
    const m = method.toUpperCase();
    if (m !== "POST" && m !== "PUT" && m !== "PATCH" && m !== "DELETE") return false;
    return OFFLINE_MUTATION_ENDPOINTS.some((ep) => url.includes(ep));
}

/**
 * Optimistically update relevant local IndexedDB caches when an offline mutation occurs
 */
async function applyOptimisticCacheUpdates(url: string, method: string, body: any, fakeItem: any) {
    try {
        if (url.startsWith("/api/expenses/personal") && method === "POST") {
            // 1. Prepend to personal expenses cache: { expenses: [...] }
            const cachedExpObj = await getCachedApi<any>("/api/expenses/personal");
            const currentList = Array.isArray(cachedExpObj?.expenses)
                ? cachedExpObj.expenses
                : Array.isArray(cachedExpObj)
                ? cachedExpObj
                : [];
            await setCachedApi("/api/expenses/personal", { expenses: [fakeItem, ...currentList] });

            // 2. Deduct from account balance if accountId is present: { accounts: [...] }
            if (body?.accountId && body?.amount) {
                const cachedAccObj = await getCachedApi<any>("/api/accounts");
                if (cachedAccObj && Array.isArray(cachedAccObj.accounts)) {
                    const updatedAccounts = cachedAccObj.accounts.map((acc: any) => {
                        if (acc.id === body.accountId) {
                            return { ...acc, balance: Number(acc.balance) - Number(body.amount) };
                        }
                        return acc;
                    });
                    await setCachedApi("/api/accounts", { accounts: updatedAccounts });
                }
            }

            // 3. Update overview stats if cached: { totalExpenses, thisMonthExpenses, ... }
            const cachedOverview = await getCachedApi<any>("/api/stats/overview");
            if (cachedOverview) {
                await setCachedApi("/api/stats/overview", {
                    ...cachedOverview,
                    totalExpenses: (cachedOverview.totalExpenses || 0) + Number(body.amount || 0),
                    thisMonthExpenses: (cachedOverview.thisMonthExpenses || 0) + Number(body.amount || 0),
                });
            }
        } else if (url.includes("/expenses") && url.includes("/workspaces/") && method === "POST") {
            // Shared workspace expense
            const wsIdMatch = url.match(/\/api\/workspaces\/([^/]+)\/expenses/);
            if (wsIdMatch) {
                const wsId = wsIdMatch[1];
                const cachedWsExpenses = await getCachedApi<any>(`/api/workspaces/${wsId}/expenses`);
                const currentWsList = Array.isArray(cachedWsExpenses?.expenses)
                    ? cachedWsExpenses.expenses
                    : Array.isArray(cachedWsExpenses)
                    ? cachedWsExpenses
                    : [];
                await setCachedApi(`/api/workspaces/${wsId}/expenses`, { expenses: [fakeItem, ...currentWsList] });

                // If paid from personal account, deduct
                if (body?.accountId) {
                    const cachedAccObj = await getCachedApi<any>("/api/accounts");
                    if (cachedAccObj && Array.isArray(cachedAccObj.accounts)) {
                        const paidAmount = Number(body.amount || 0);
                        const updatedAccounts = cachedAccObj.accounts.map((acc: any) => {
                            if (acc.id === body.accountId) {
                                return { ...acc, balance: Number(acc.balance) - paidAmount };
                            }
                            return acc;
                        });
                        await setCachedApi("/api/accounts", { accounts: updatedAccounts });
                    }
                }
            }
        } else if (url.includes("/deposit") && url.includes("/api/accounts/") && method === "POST") {
            // Income deposit: /api/accounts/[id]/deposit
            const accIdMatch = url.match(/\/api\/accounts\/([^/]+)\/deposit/);
            if (accIdMatch && body?.amount) {
                const accId = accIdMatch[1];
                const cachedAccObj = await getCachedApi<any>("/api/accounts");
                if (cachedAccObj && Array.isArray(cachedAccObj.accounts)) {
                    const updatedAccounts = cachedAccObj.accounts.map((acc: any) => {
                        if (acc.id === accId) {
                            return { ...acc, balance: Number(acc.balance) + Number(body.amount) };
                        }
                        return acc;
                    });
                    await setCachedApi("/api/accounts", { accounts: updatedAccounts });
                }
            }
        } else if (url === "/api/accounts/transfer" && method === "POST") {
            // Account transfer: deduct from source, add to destination
            const { fromAccountId, toAccountId, amount } = body || {};
            if (fromAccountId && toAccountId && amount) {
                const num = Number(amount);
                const cachedAccObj = await getCachedApi<any>("/api/accounts");
                if (cachedAccObj && Array.isArray(cachedAccObj.accounts)) {
                    const updatedAccounts = cachedAccObj.accounts.map((acc: any) => {
                        if (acc.id === fromAccountId) {
                            return { ...acc, balance: Number(acc.balance) - num };
                        }
                        if (acc.id === toAccountId) {
                            return { ...acc, balance: Number(acc.balance) + num };
                        }
                        return acc;
                    });
                    await setCachedApi("/api/accounts", { accounts: updatedAccounts });
                }
            }
        }
    } catch (e) {
        console.warn("Optimistic cache update failed:", e);
    }
}

export async function apiFetch<T>(
    url: string,
    options?: RequestInit
): Promise<T> {
    const method = (options?.method || "GET").toUpperCase();
    const isGet = method === "GET";
    const isBrowser = typeof window !== "undefined";
    const isOffline = isBrowser && !navigator.onLine;

    // --- 1. HANDLE OFFLINE GET REQUESTS ---
    if (isGet && isOffline) {
        const cached = await getCachedApi<T>(url);
        if (cached !== null) {
            return cached;
        }
        // If not cached, let it proceed to fetch which will reject into network error
    }

    // --- 2. HANDLE OFFLINE MUTATIONS (POST / PUT / PATCH / DELETE) ---
    if (!isGet && (isOffline || isOfflineEligibleMutation(url, method))) {
        if (isOffline) {
            return handleOfflineMutation<T>(url, method, options);
        }
    }

    // --- 3. STANDARD ONLINE FETCH ---
    try {
        const res = await fetch(url, {
            ...options,
            headers: { "Content-Type": "application/json", ...options?.headers },
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error?.formErrors?.[0] ?? data.error ?? "Request failed");
        }

        // Cache successful GET requests in IndexedDB for offline reading
        if (isGet && isBrowser) {
            setCachedApi(url, data).catch(() => {});
        }

        return data;
    } catch (err: any) {
        // --- 4. NETWORK FAILURE FALLBACK ---
        // If network failed during GET: return cached response if available
        if (isGet && isBrowser) {
            const cached = await getCachedApi<T>(url);
            if (cached !== null) {
                return cached;
            }
        }

        // If network failed during an eligible mutation: queue it offline
        const isNetworkError =
            err?.message === "Failed to fetch" ||
            err?.name === "TypeError" ||
            (isBrowser && !navigator.onLine);

        if (!isGet && isNetworkError && isOfflineEligibleMutation(url, method)) {
            return handleOfflineMutation<T>(url, method, options);
        }

        throw err;
    }
}

/**
 * Intercept an offline mutation, queue it to IndexedDB, update local cache, and return mock record
 */
async function handleOfflineMutation<T>(url: string, method: string, options?: RequestInit): Promise<T> {
    let parsedBody: any = null;
    if (options?.body) {
        try {
            parsedBody = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
        } catch {
            parsedBody = options.body;
        }
    }

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();

    const mockRecord: any = {
        id: tempId,
        ...(parsedBody || {}),
        createdAt: nowIso,
        updatedAt: nowIso,
        _isOfflinePending: true,
    };

    // Standard wrapper response shape (API returns { expense: ... } or { category: ... })
    const mockResponse: any = (url.includes("/expenses") || url.includes("/personal"))
        ? { expense: mockRecord, id: tempId, ...mockRecord }
        : { ...mockRecord };

    // Queue mutation in IndexedDB
    await addToSyncQueue({
        url,
        method,
        body: parsedBody,
        description: parsedBody?.description || `Offline ${method} ${url}`,
    });

    // Optimistically update caches
    await applyOptimisticCacheUpdates(url, method, parsedBody, mockRecord);

    // Notify listeners (SyncContext, banners)
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("offline-mutation-queued", { detail: mockRecord }));
    }

    return mockResponse as T;
}