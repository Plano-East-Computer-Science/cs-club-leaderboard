import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind class lists; later classes win. Used by the shadcn components. */
export const cn = (...inputs) => twMerge(clsx(inputs));
