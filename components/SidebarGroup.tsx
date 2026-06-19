"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export function SidebarGroup({
  title,
  icon,
  children,
  hrefs,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  hrefs: string[];
}) {
  const pathname = usePathname();
  const isActive = hrefs.some(
    (href) => pathname === href || pathname.startsWith(href + "/")
  );
  const [open, setOpen] = useState(isActive);

  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  return (
    <div className="nav-group">
      <button
        type="button"
        className={`nav-group-toggle${isActive ? " nav-group-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="nav-group-icon">{icon}</span>
        <span className="nav-group-title">{title}</span>
        <span className="nav-group-arrow">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="nav-group-items">{children}</div>}
    </div>
  );
}
