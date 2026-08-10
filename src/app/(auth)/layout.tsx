/**
 * Auth layout — minimal chrome for login page.
 * No dashboard shell (sidebar, header) rendered here.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
