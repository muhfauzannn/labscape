import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & {
  tone?: "neutral" | "sky" | "mint" | "lilac" | "butter";
}) {
  return (
    <span className={cn("badge", `badge--${tone}`, className)} {...props} />
  );
}
