import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Parse "YYYY-MM-DD" as local midnight (avoids UTC offset issues with new Date() / parseISO). */
export function parseLocalDate(dateStr: string | undefined | null): Date {
  if (!dateStr) return new Date(NaN);
  // Handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm:ss" formats
  const datePart = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  const parts = datePart.split("-").map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return new Date(NaN);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}
