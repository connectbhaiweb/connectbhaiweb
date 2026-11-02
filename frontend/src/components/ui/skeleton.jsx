import { cn } from "@/lib/utils";

/* shadcn/ui Skeleton: shimmering placeholder. Give it the size of the content it stands in for to avoid layout shift. */
function Skeleton({ className, ...props }) {
  return <div data-slot="skeleton" aria-hidden="true" className={cn("sk rounded-lg", className)} {...props} />;
}
export { Skeleton };
