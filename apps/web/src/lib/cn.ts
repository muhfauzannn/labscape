import { clsx, type ClassValue } from "clsx";
/** Class composition only; variants own their styles. */
export function cn(...values: ClassValue[]) {
  return clsx(values);
}
