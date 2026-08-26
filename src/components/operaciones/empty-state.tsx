import type { ReactNode } from 'react';
import { CircleDashed } from 'lucide-react';

export type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/**
 * EmptyState — fixed order icon → title → description → optional action
 * (REQ-COS-14). Icon is CircleDashed at 40px muted; title 15px/500;
 * description 12px muted. Tokens only, no hex.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={className}>
      <CircleDashed aria-hidden className="size-10 text-text-muted" />
      <h3 className="text-[15px] font-medium text-text-primary">{title}</h3>
      {description ? <p className="text-xs text-text-muted">{description}</p> : null}
      {action}
    </div>
  );
}