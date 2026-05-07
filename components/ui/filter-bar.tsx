import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function FilterBar({ className, children }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("sf-toolbar grid gap-3 p-3", className)}>{children}</div>;
}
