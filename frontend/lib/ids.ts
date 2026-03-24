export function isProbablyMongoObjectId(value: string) {
  return /^[0-9a-fA-F]{24}$/.test(value);
}

export function normalizeRecordId(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    let trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed === "undefined" || trimmed === "null" || trimmed === "[object Object]") return null;

    const objectIdWrapped = trimmed.match(/^ObjectId\(["']([0-9a-fA-F]{24})["']\)$/);
    if (objectIdWrapped) return objectIdWrapped[1];

    if (trimmed.includes(",")) {
      const first = trimmed.split(",")[0]?.trim();
      if (first && isProbablyMongoObjectId(first)) return first;
    }

    return trimmed;
  }

  if (typeof value === "number" || typeof value === "bigint") return String(value);

  if (Array.isArray(value)) {
    for (const part of value) {
      const normalized = normalizeRecordId(part);
      if (normalized) return normalized;
    }
    return null;
  }

  if (typeof value === "object") {
    const anyValue: any = value;
    if (typeof anyValue.$oid === "string") return normalizeRecordId(anyValue.$oid);
    if (typeof anyValue.oid === "string") return normalizeRecordId(anyValue.oid);
    if (typeof anyValue._id === "string") return normalizeRecordId(anyValue._id);
    if (typeof anyValue.toHexString === "function") {
      try {
        return normalizeRecordId(anyValue.toHexString());
      } catch {
        // ignore
      }
    }
    const str = String(value);
    if (str && str !== "[object Object]" && str !== "undefined" && str !== "null") return str.trim();
  }

  return null;
}

