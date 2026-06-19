import { SidebarLink } from "./SidebarLink";
import { SidebarGroup } from "./SidebarGroup";
import { UserDropdown } from "./UserDropdown";
import { Activity, BarChart3, ChevronLeft, ClipboardCheck, Database, FileText, Menu, Network, Printer, Server, Settings, Thermometer, Users, X } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { roleLabels } from "@/lib/constants";

export async function AppShell({ children, title, subtitle, variant }: { children: React.ReactNode; title: string; subtitle?: string; variant?: "daily-report" }) {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="app-shell-container">
      <input type="checkbox" id="sidebar-toggle" className="sidebar-toggle-checkbox" defaultChecked={false} />
      <input type="checkbox" id="sidebar-collapse" className="sidebar-collapse-checkbox" defaultChecked={false} />
      
      <header className="mobile-header no-print">
        <div className="brand">
          <div className="brand-mark">DC</div>
          <div>
            <div>Data Center Operations</div>
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
            <div className="brand-mark">DC</div>
            <div className="brand-text">
              <div>Data Center Operations</div>
            </div>
            <label htmlFor="sidebar-toggle" className="sidebar-close-btn">
              <X size={20} />
            </label>
          </div>
          <label htmlFor="sidebar-collapse" className="sidebar-collapse-toggle">
            <ChevronLeft size={16} className="collapse-icon" />
          </label>
          <nav className="nav">
            <SidebarGroup title="ภาพรวม" icon="📊" hrefs={["/", "/reports"]}>
              <SidebarLink href="/"><BarChart3 size={18} /> Dashboard</SidebarLink>
              <SidebarLink href="/reports" exact><FileText size={18} /> Monthly Operations</SidebarLink>
            </SidebarGroup>

            <SidebarGroup title="การตรวจสอบสถานะ" icon="🖥️" hrefs={["/reports/daily", "/servers/metrics"]}>
              <SidebarLink href="/reports/daily/vm"><ClipboardCheck size={18} /> VM Host</SidebarLink>
              <SidebarLink href="/reports/daily/host"><ClipboardCheck size={18} /> Host Server</SidebarLink>
              <SidebarLink href="/reports/daily/network"><ClipboardCheck size={18} /> Network Device</SidebarLink>
              <SidebarLink href="/reports/daily/backup"><ClipboardCheck size={18} /> Database</SidebarLink>
              <SidebarLink href="/servers/metrics"><Activity size={18} /> บันทึก Metrics</SidebarLink>
            </SidebarGroup>

            <SidebarGroup title="ห้อง Data Center" icon="🏢" hrefs={["/checklist"]}>
              <SidebarLink href="/checklist/inspection"><Thermometer size={18} /> ตรวจสอบรายวัน</SidebarLink>
              <SidebarLink href="/checklist/history"><BarChart3 size={18} /> ประวัติและกราฟ</SidebarLink>
            </SidebarGroup>

            {isAdmin && (
              <>
                <SidebarGroup title="จัดการทรัพย์สิน" icon="📦" hrefs={["/admin/assets"]}>
                  <SidebarLink href="/admin/assets/vm"><Database size={18} /> VM Host</SidebarLink>
                  <SidebarLink href="/admin/assets/host"><Server size={18} /> Host Server</SidebarLink>
                  <SidebarLink href="/admin/assets/network"><Network size={18} /> Network Device</SidebarLink>
                  <SidebarLink href="/admin/assets/backup"><Database size={18} /> Database</SidebarLink>
                  <SidebarLink href="/admin/assets/print"><Printer size={18} /> พิมพ์บัญชีทรัพย์สิน</SidebarLink>
                </SidebarGroup>

                <SidebarGroup title="การตั้งค่า" icon="⚙️" hrefs={["/admin/settings", "/admin/datacenters", "/admin/checklist"]}>
                  <SidebarLink href="/admin/settings/basic"><Settings size={18} /> ข้อมูลพื้นฐาน</SidebarLink>
                  <SidebarLink href="/admin/datacenters"><Database size={18} /> จัดการ Data Center</SidebarLink>
                  <SidebarLink href="/admin/checklist"><ClipboardCheck size={18} /> จัดการ Checklist</SidebarLink>
                </SidebarGroup>

                <SidebarGroup title="ผู้ใช้งานและความปลอดภัย" icon="👤" hrefs={["/admin/users", "/security"]}>
                  <SidebarLink href="/admin/users"><Users size={18} /> จัดการผู้ใช้งาน</SidebarLink>
                </SidebarGroup>
              </>
            )}
          </nav>
        </aside>
        <main className="main">
          <div className={`topbar${variant ? ` topbar-${variant}` : ""}`}>
            <div>
              <div className="eyebrow">Data Center Operations</div>
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
          {children}
        </main>
      </div>
    </div>
  );
}
