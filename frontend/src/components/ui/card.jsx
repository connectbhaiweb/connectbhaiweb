import * as React from "react";
import { cn } from "@/lib/utils";

/* shadcn/ui Card. `interactive` adds the hover-lift used for result/KPI cards. */
function Card({ className, interactive = false, ...props }) {
  return (
    <div data-slot="card"
      className={cn("flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm",
        interactive && "transition-all duration-200 hover:-translate-y-1 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/15", className)}
      {...props} />
  );
}
const CardHeader = ({ className, ...p }) => <div data-slot="card-header" className={cn("flex flex-col gap-1", className)} {...p} />;
const CardTitle = ({ className, ...p }) => <h3 data-slot="card-title" className={cn("font-display text-lg font-bold leading-tight", className)} {...p} />;
const CardDescription = ({ className, ...p }) => <p data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...p} />;
const CardContent = ({ className, ...p }) => <div data-slot="card-content" className={cn(className)} {...p} />;
const CardFooter = ({ className, ...p }) => <div data-slot="card-footer" className={cn("flex items-center gap-2", className)} {...p} />;
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
