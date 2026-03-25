import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-border bg-card text-foreground shadow-[0_1px_0_hsl(0_0%_100%_/_0.65)_inset]",
        secondary:
          "border-border bg-secondary text-secondary-foreground",
        accent:
          "border-border bg-accent text-accent-foreground",
        success:
          "border-[color-mix(in_srgb,var(--success)_22%,var(--border))] bg-success-subtle text-success",
        warning:
          "border-[color-mix(in_srgb,var(--warning)_24%,var(--border))] bg-warning-subtle text-warning-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
        luxury:
          "border-[color-mix(in_srgb,var(--luxury)_30%,var(--border))] bg-luxury-soft text-[color-mix(in_srgb,var(--luxury)_22%,var(--foreground))]",
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
