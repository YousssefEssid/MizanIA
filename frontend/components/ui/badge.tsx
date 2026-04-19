import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "text-foreground",
        success:
          "border-transparent bg-[hsl(var(--success-soft))] text-[hsl(var(--success-fg))] dark:bg-[hsl(var(--success-soft))] dark:text-[hsl(var(--success-fg))]",
        warning:
          "border-transparent bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning-fg))] dark:bg-[hsl(var(--warning-soft))] dark:text-[hsl(var(--warning-fg))]",
        danger:
          "border-transparent bg-[hsl(var(--badge-danger-bg))] text-[hsl(var(--badge-danger-fg))]",
        info: "border-transparent bg-[hsl(var(--info-soft))] text-[hsl(var(--info-fg))] dark:bg-[hsl(var(--info-soft))] dark:text-[hsl(var(--info-fg))]",
        neutral:
          "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
