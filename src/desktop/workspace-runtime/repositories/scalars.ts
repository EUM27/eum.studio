import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";

export function readRequiredString(
  row: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = row[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

export function readRequiredInteger(
  row: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = row[field];
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value)
  ) {
    throw new Error(`${label}.${field} must be a safe integer`);
  }
  return value;
}

export function readNullableIdentity<TEntity extends string>(
  row: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> | null {
  const value = row[field];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be null or a non-empty string`);
  }
  return entityId<TEntity>(value);
}

export function parseStoredStringArray(
  value: string,
  label: string,
): readonly string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${label} must be JSON`);
  }
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
    throw new Error(`${label} must be a string array`);
  }
  return Object.freeze(parsed.map((entry) => entry as string));
}

export function readNullableFiniteNumber(
  row: Record<string, unknown>,
  field: string,
  label: string,
): number | null {
  const value = row[field];
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label}.${field} must be null or a finite number`);
  }
  return value;
}

export function readString(
  row: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = row[field];
  if (typeof value !== "string") {
    throw new Error(`${label}.${field} must be a string`);
  }
  return value;
}

export function readNullableString(
  row: Record<string, unknown>,
  field: string,
  label: string,
): string | null {
  const value = row[field];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be null or a non-empty string`);
  }
  return value;
}

export function readNullableInteger(
  row: Record<string, unknown>,
  field: string,
  label: string,
): number | null {
  const value = row[field];
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}.${field} must be null or a non-negative integer`);
  }
  return value;
}

export function readTimestamp(value: string, label: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${label} must be an ISO timestamp`);
  }
  return timestamp;
}

