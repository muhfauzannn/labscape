import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  asChild?: boolean;
};
export function Button({
  variant = "primary",
  size = "md",
  asChild,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      {...(!asChild ? { type } : {})}
      className={cn(
        "button",
        `button--${variant}`,
        `button--${size}`,
        className,
      )}
      {...props}
    />
  );
}
