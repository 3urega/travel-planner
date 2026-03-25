import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-zinc-700 bg-zinc-800/80 text-zinc-200",
        success:
          "border-emerald-800/60 bg-emerald-950/50 text-emerald-300",
        warning:
          "border-amber-800/60 bg-amber-950/40 text-amber-200",
        accent:
          "border-violet-800/60 bg-violet-950/40 text-violet-200",
        muted: "border-zinc-800/80 bg-zinc-900/60 text-zinc-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps): React.ReactElement {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
