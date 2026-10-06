export async function apiFetch<T>(
    url: string,
    options?: RequestInit
): Promise<T> {
    const res = await fetch(url, {
        cache: "no-store",
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
    });

    let data: any;
    try {
        data = await res.json();
    } catch {
        if (!res.ok) {
            throw new Error(`Request failed with status ${res.status}`);
        }
        return {} as T;
    }

    if (!res.ok) {
        const message =
            data?.error?.formErrors?.[0] ??
            data?.error ??
            data?.detail ??
            data?.message ??
            `Request failed with status ${res.status}`;
        const error: any = new Error(typeof message === "string" ? message : JSON.stringify(message));
        error.status = res.status;
        error.data = data;
        throw error;
    }

    return data as T;
}