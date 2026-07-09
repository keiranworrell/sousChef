import type { ApiResponse, ApiSuccess, ApiError } from "../types";

export function isApiSuccess<T>(res: ApiResponse<T>): res is ApiSuccess<T> {
  return "data" in res;
}

export function isApiError<T>(res: ApiResponse<T>): res is ApiError {
  return "error" in res;
}

/**
 * Clamp a number between min and max (inclusive).
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Round to a given number of decimal places.
 */
export function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
export * from "./predictive-tags";
