import type { ApiErrorBody } from "@/domain/types";

export class ClientApiError extends Error {
  readonly code: string;
  readonly fields: Record<string, string>;

  constructor(
    message: string,
    code = "INTERNAL",
    fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ClientApiError";
    this.code = code;
    this.fields = fields;
  }
}

function fieldMap(details: ApiErrorBody["error"]["details"]): Record<string, string> {
  const fields = details?.fields;
  if (!fields || typeof fields !== "object") return {};
  const mapped: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "string") mapped[key] = value;
    else if (Array.isArray(value) && typeof value[0] === "string") mapped[key] = value[0];
  }
  return mapped;
}

export async function clientApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      throw new ClientApiError("The server returned an unexpected response.");
    }
  }

  if (!response.ok) {
    const error = body as Partial<ApiErrorBody> | null;
    throw new ClientApiError(
      error?.error?.message ?? "The server refused that action.",
      error?.error?.code ?? "INTERNAL",
      fieldMap(error?.error?.details),
    );
  }

  return body as T;
}
