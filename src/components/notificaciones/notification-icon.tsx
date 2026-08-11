/**
 * Pure component: renders an emoji icon based on notification type.
 */
export function NotificationIcon({ tipo }: { tipo: string }) {
  const icon = ICON_MAP[tipo] ?? ICON_MAP.default;
  return (
    <span className="text-lg leading-none" aria-hidden="true">
      {icon}
    </span>
  );
}

const ICON_MAP: Record<string, string> = {
  premio: '\u{1F381}', // 🎁
  premio_cerca: '\u{2B50}', // ⭐
  botellon_danado: '\u{1F527}', // 🔧
  inactividad: '\u26A0\uFE0F', // ⚠️
  default: '\u{1F514}', // 🔔
};
