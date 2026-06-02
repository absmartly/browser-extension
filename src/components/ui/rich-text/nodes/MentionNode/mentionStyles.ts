import { twMerge } from "tailwind-merge"

const baseMentionClasses = "py-0.5 px-1.5 rounded-md text-xs font-semibold"

export const getMentionClasses = (additionalClasses?: string): string =>
  twMerge(baseMentionClasses, additionalClasses)
