/**
 * SkipLink provides a keyboard-accessible "Skip to content" link.
 * It is visually hidden until focused, then appears as the first
 * tab-stop on every page. Activating it moves focus to #main-content.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:rounded-md focus:bg-zinc-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:focus:bg-zinc-50 dark:focus:text-zinc-900"
    >
      Skip to content
    </a>
  );
}
