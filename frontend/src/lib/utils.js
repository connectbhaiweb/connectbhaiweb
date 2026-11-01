import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/* shadcn/ui helper: merge conditional class names, later Tailwind classes win. */
export function cn(...inputs) { return twMerge(clsx(inputs)); }
