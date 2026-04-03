export function parseApiError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const data = payload as Record<string, unknown>;
  const detail = data.detail;

  if (typeof detail === "string" && detail.trim().length > 0) return detail;
  if (detail && typeof detail === "object") {
    const d = detail as Record<string, unknown>;
    if (typeof d.message === "string" && d.message.trim().length > 0) return d.message;
    if (typeof d.code === "string" && d.code.trim().length > 0) return d.code;
  }

  if (typeof data.message === "string" && data.message.trim().length > 0) return data.message;
  return fallback;
}

