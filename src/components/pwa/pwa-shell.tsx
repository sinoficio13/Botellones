"use client";

import { UpdatePrompt as PwaUpdatePrompt } from "@/components/pwa/update-prompt";

/**
 * Client-side wrapper for PWA components that must be rendered
 * within the server-component root layout.
 */
export function PwaShell() {
  return <PwaUpdatePrompt />;
}
