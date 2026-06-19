"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SidebarLink({
  href,
  children,
  onClick,
  exact
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const isActive = exact || href === "/"
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={isActive ? "active" : ""}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
