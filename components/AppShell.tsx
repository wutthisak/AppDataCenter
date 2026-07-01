import { SidebarLink } from "./SidebarLink";
import { SidebarGroup } from "./SidebarGroup";
import { UserDropdown } from "./UserDropdown";
import { Activity, BarChart3, ChevronLeft, ClipboardCheck, Database, FileText, HardDrive, LogOut, Menu, Network, Printer, Server, Settings, Thermometer, User, Users, Wrench, X } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { roleLabels } from "@/lib/constants";

export async function AppShell({
  children,
  title,
  subtitle,
  variant,
  hideTopbar
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  variant?: "daily-report";
  hideTopbar?: boolean;
}) {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="app-shell-container">
      <input type="checkbox" id="sidebar-toggle" className="sidebar-toggle-checkbox" defaultChecked={false} />
      <input type="checkbox" id="sidebar-collapse" className="sidebar-collapse-checkbox" defaultChecked={false} />
      
      <header className="mobile-header no-print">
        <div className="brand">
          <div className="brand-mark" title="Infrastructure Operations Center">IOC</div>
          <div>
            <div className="brand-name">Infrastructure Operations</div>
          </div>
        </div>
        <label htmlFor="sidebar-toggle" className="sidebar-toggle-btn">
          <Menu size={24} />
        </label>
      </header>

      <label htmlFor="sidebar-toggle" className="sidebar-overlay"></label>

      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark" title="Infrastructure Operations Center">IOC</div>
            <div className="brand-text">
              <div className="brand-name">Infrastructure Operations Center</div>
              <div className="brand-sub">ศูนย์ปฏิบัติการและติดตามโครงสร้างพื้นฐาน IT</div>
            </div>
            <label htmlFor="sidebar-toggle" className="sidebar-close-btn">
              <X size={20} />
            </label>
          </div>
          <label htmlFor="sidebar-collapse" className="sidebar-collapse-toggle">
            <ChevronLeft size={16} className="collapse-icon" />
          </label>
          <nav className="nav">
            <div className="nav-inner">
              <SidebarGroup title="Dashboard" icon="📊" hrefs={["/"]}>
                <SidebarLink href="/"><BarChart3 size={18} /> Dashboard</SidebarLink>
              </SidebarGroup>

              <SidebarGroup title="Reports" icon="📄" hrefs={["/reports"]}>
                <SidebarLink href="/reports" exact><FileText size={18} /> รายงานประจำเดือน</SidebarLink>
              </SidebarGroup>

              <SidebarGroup title="Activity" icon="📈" hrefs={["/activity"]}>
                <SidebarLink href="/activity" exact><Activity size={18} /> ติดตามการตรวจ</SidebarLink>
              </SidebarGroup>

              <SidebarGroup title="Infrastructure" icon="🖥️" hrefs={["/reports/daily", "/infrastructure"]}>
                <SidebarLink href="/reports/daily/vm"><ClipboardCheck size={18} /> VM Host</SidebarLink>
                <SidebarLink href="/reports/daily/host"><ClipboardCheck size={18} /> Host Server</SidebarLink>
                <SidebarLink href="/reports/daily/network"><ClipboardCheck size={18} /> Network Device</SidebarLink>
                <SidebarLink href="/reports/daily/storage"><ClipboardCheck size={18} /> Storage Device</SidebarLink>
                <SidebarLink href="/reports/daily/backup"><ClipboardCheck size={18} /> Database</SidebarLink>
              </SidebarGroup>

              <SidebarGroup title="Environment" icon="🏢" hrefs={["/checklist"]}>
                <SidebarLink href="/checklist/inspection"><Thermometer size={18} /> ตรวจสอบรายวัน</SidebarLink>
                <SidebarLink href="/checklist/history"><BarChart3 size={18} /> ประวัติและกราฟ</SidebarLink>
              </SidebarGroup>

              {isAdmin && (
                <>
                  <SidebarGroup title="Master Data" icon="📦" hrefs={["/admin/assets", "/admin/datacenters", "/admin/checklist", "/admin/inspection-policy"]}>
                    <SidebarLink href="/admin/assets/vm"><Database size={18} /> VM Host</SidebarLink>
                    <SidebarLink href="/admin/assets/host"><Server size={18} /> Host Server</SidebarLink>
                    <SidebarLink href="/admin/assets/network"><Network size={18} /> Network Device</SidebarLink>
                    <SidebarLink href="/admin/assets/storage"><HardDrive size={18} /> Storage Device</SidebarLink>
                    <SidebarLink href="/admin/assets/backup"><Database size={18} /> Database</SidebarLink>
                    <SidebarLink href="/admin/assets/print"><Printer size={18} /> พิมพ์บัญชีทรัพย์สิน</SidebarLink>
                    <SidebarLink href="/admin/datacenters"><Database size={18} /> จัดการ Data Center</SidebarLink>
                    <SidebarLink href="/admin/checklist"><ClipboardCheck size={18} /> จัดการ Checklist</SidebarLink>
                    <SidebarLink href="/admin/inspection-policy"><ClipboardCheck size={18} /> Inspection Policy</SidebarLink>
                  </SidebarGroup>

                  <SidebarGroup title="Administration" icon="⚙️" hrefs={["/admin/settings", "/admin/users", "/admin/maintenance"]}>
                    <SidebarLink href="/admin/settings/basic"><Settings size={18} /> ข้อมูลพื้นฐาน</SidebarLink>
                    <SidebarLink href="/admin/users"><Users size={18} /> จัดการผู้ใช้งาน</SidebarLink>
                    <SidebarLink href="/admin/maintenance"><Wrench size={18} /> System Maintenance</SidebarLink>
                  </SidebarGroup>
                </>
              )}

              {user ? (
                <SidebarGroup title="บัญชีของฉัน" icon="👤" hrefs={["/profile"]}>
                  <SidebarLink href="/profile" exact><User size={18} /> โปรไฟล์และความปลอดภัย</SidebarLink>
                </SidebarGroup>
              ) : null}

            </div>
          </nav>
          {user ? (
            <div className="sidebar-logout-pinned">
              <form action={logoutAction}>
                <button type="submit" className="sidebar-logout-btn">
                  <LogOut size={17} />
                  <span>ออกจากระบบ</span>
                </button>
              </form>
            </div>
          ) : null}
        </aside>
        <main className="main">
          {!hideTopbar && title ? (
            <div className={`topbar${variant ? ` topbar-${variant}` : ""}`}>
              <div>
                <div className="eyebrow">Infrastructure Operations Center</div>
                <h1>{title}</h1>
                {subtitle ? <p className="muted">{subtitle}</p> : null}
              </div>
              {user ? (
                <UserDropdown
                  displayName={user.displayName}
                  roleLabel={roleLabels[user.role]}
                />
              ) : null}
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
