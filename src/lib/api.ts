const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://wrt0xf7505.execute-api.us-east-1.amazonaws.com/dev";

interface RequestOptions extends RequestInit {
    email?: string;
}

export async function apiClient(endpoint: string, options: RequestOptions = {}) {
    const { email, headers, ...rest } = options;

    const baseUrl = BACKEND_URL.replace(/\/$/, "");
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${cleanEndpoint}`;

    const defaultHeaders: Record<string, string> = {};

    // Don't set Content-Type if body is FormData (browser will set it with boundary)
    if (!(rest.body instanceof FormData)) {
        defaultHeaders["Content-Type"] = "application/json";
    }

    if (email) {
        defaultHeaders["email"] = email;
    }

    console.log(`🚀 API Call: ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
        ...rest,
        headers: {
            ...defaultHeaders,
            ...headers,
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.detail || "API request failed");
    }

    return response.json();
}
