'use client';

import { getNivelLoyalty, getProgressPercent } from '@/lib/loyalty';

interface Props {
  total: number;
}

export function LoyaltyBadge({ total }: Props) {
  const { label, color } = getNivelLoyalty(total);
  const progress = getProgressPercent(total);
  const isPlatino = total >= 500;

  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (circumference * progress) / 100;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Circular progress */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            className="stroke-zinc-200 dark:stroke-zinc-800"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
          {/* Checkmark for Platino */}
          {isPlatino && (
            <g transform={`rotate(90, ${center}, ${center})`}>
              <path
                d={`M${center - 16},${center} L${center - 4},${center + 12} L${center + 16},${center - 12}`}
                fill="none"
                stroke={color}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isPlatino ? (
            <span className="text-xs font-bold tracking-wider text-zinc-500 dark:text-zinc-400">
              MAX
            </span>
          ) : (
            <>
              <span className="text-lg font-bold" style={{ color }}>
                {progress}%
              </span>
              <span className="text-[10px] text-zinc-400">
                hacia {Math.ceil(total / 100) * 100}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Tier label */}
      <div className="text-center">
        <span
          className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            backgroundColor: `${color}20`,
            color,
            border: `1px solid ${color}40`,
          }}
        >
          {label}
        </span>
        <p className="mt-1 text-xs text-zinc-500">
          {total} recarga{total !== 1 ? 's' : ''} total{total !== 1 ? 'es' : ''}
        </p>
      </div>
    </div>
  );
}
