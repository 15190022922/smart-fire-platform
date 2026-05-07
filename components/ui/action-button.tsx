import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ActionButtonVariant = "primary" | "secondary" | "danger" | "warning";
type ActionButtonSize = "sm" | "md" | "xs";

const variantClassMap: Record<ActionButtonVariant, string> = {
  primary: "sf-button-primary",
  secondary: "sf-button-secondary",
  danger: "sf-button-danger",
  warning: "sf-button-warning",
};

const sizeClassMap: Record<ActionButtonSize, string> = {
  xs: "h-8 px-3 text-xs",
  sm: "h-10 px-4 text-sm",
  md: "h-11 px-5 text-sm",
};

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  active?: boolean;
};

export function ActionButton({
  variant = "secondary",
  size = "sm",
  active = false,
  className,
  type = "button",
  ...props
}: ActionButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "sf-button",
        variantClassMap[active ? "primary" : variant],
        sizeClassMap[size],
        className,
      )}
      {...props}
    />
  );
}
