import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ADMIN_COOKIE, validateSession } from "@/lib/auth";

const NAV: Array<{ href: string; label: string }> = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/settings", label: "Settings" },
];

// Shell for protected admin pages. Redirects to /admin/login when the
// session cookie is missing or invalid.
export async function AdminShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active: string;
}) {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token || !(await validateSession(token))) {
    redirect("/admin/login");
  }
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          Omotenashi TCG
          <small>Japan Branch — Admin</small>
        </div>
        <nav className="admin-nav">
          <span className="nav-label">Manage</span>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={active === item.href ? "active" : ""}
            >
              {item.label}
            </Link>
          ))}
          <span className="nav-label">Store</span>
          <a href="/" target="_blank" rel="noreferrer">
            View Store ↗
          </a>
        </nav>
        <form
          action="/api/admin/auth/logout"
          method="POST"
          style={{ marginTop: "auto" }}
        >
          <button type="submit" className="admin-logout">
            Log out
          </button>
        </form>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
