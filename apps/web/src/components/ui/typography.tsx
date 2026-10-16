import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
export function Heading({
  as: Tag = "h2",
  size = "section",
  className,
  ...props
}: ComponentProps<"h2"> & {
  as?: "h1" | "h2" | "h3";
  size?: "display" | "section" | "title";
}) {
  return (
    <Tag className={cn("heading", `heading--${size}`, className)} {...props} />
  );
}
export function Text({
  as: Tag = "p",
  tone = "secondary",
  className,
  ...props
}: ComponentProps<"p"> & {
  as?: "p" | "span";
  tone?: "primary" | "secondary" | "muted";
}) {
  return <Tag className={cn("text", `text--${tone}`, className)} {...props} />;
}
