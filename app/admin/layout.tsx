import "./admin.css";

// Admin layout: renders children only. Protected pages wrap their content
// in <AdminShell> (which enforces the session). /admin/login does not use
// AdminShell so it can render without a session.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
