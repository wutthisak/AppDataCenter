import { AppShell } from "@/components/AppShell";
import { changePasswordAction, updateProfileAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { roleLabels } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { currentBuddhistYear } from "@/lib/date";

const SHIFT_OPTIONS = [
  { value: "OFFICE_HOURS", label: "ในเวลาราชการ (08:00-16:00)" },
  { value: "MORNING_SHIFT", label: "เวรเช้า (08:00-16:00)" },
  { value: "AFTERNOON_SHIFT", label: "เวรบ่าย (16:00-24:00)" },
  { value: "NIGHT_SHIFT", label: "เวรดึก (00:00-08:00)" },
];

export default async function ProfilePage(props: { searchParams: Promise<{ updated?: string; error?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser();

  // Fetch full user data
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true, username: true, displayName: true, role: true,
      position: true, department: true, email: true, phone: true, defaultShift: true,
      twoFactorEnabled: true
    }
  });
  if (!fullUser) return null;

  // Personal stats: this month
  const now = new Date();
  const month = now.getMonth() + 1;
  const buddhistYear = currentBuddhistYear();
  const report = await prisma.monthlyReport.findUnique({
    where: { month_buddhistYear: { month, buddhistYear } }
  });

  let totalEntries = 0;
  let vmCount = 0, serverCount = 0, networkCount = 0, backupCount = 0;
  if (report) {
    const entries = await prisma.dailyStatusEntry.findMany({
      where: {
        reportId: report.id,
        OR: [{ recordedById: user.id }, { updatedById: user.id }]
      },
      include: { asset: { include: { category: true } } }
    });
    totalEntries = entries.length;
    for (const e of entries) {
      const cc = e.asset.category.code;
      if (cc === "VM") vmCount++;
      else if (cc === "SERVER") serverCount++;
      else if (cc === "NETWORK") networkCount++;
      else if (cc === "BACKUP") backupCount++;
    }
  }

  return (
    <AppShell title="โปรไฟล์ของฉัน" subtitle="จัดการข้อมูลส่วนตัวและความปลอดภัยบัญชี">
      {/* Success/Error messages */}
      {searchParams.updated === "profile" && (
        <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#166534" }}>บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว</div>
      )}
      {searchParams.updated && searchParams.updated !== "profile" && (
        <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#166534" }}>เปลี่ยนรหัสผ่านเรียบร้อยแล้ว</div>
      )}
      {searchParams.error === "invalid" && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#991b1b" }}>ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง</div>
      )}
      {searchParams.error === "wrong" && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#991b1b" }}>รหัสผ่านปัจจุบันไม่ถูกต้อง</div>
      )}

      {/* Profile Info Card */}
      <section style={{ marginBottom: 20, borderRadius: 14, overflow: "hidden", border: "1px solid #e2e8f0", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)", padding: "16px 24px", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700 }}>
              {fullUser.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{fullUser.displayName}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{roleLabels[fullUser.role]} · @{fullUser.username}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: "20px 24px" }}>
          <form action={updateProfileAction}>
            <input type="hidden" name="returnTo" value="/profile" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16, marginBottom: 20 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 500, color: "#374151" }}>
                ชื่อ-สกุล
                <input name="displayName" defaultValue={fullUser.displayName} required style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 500, color: "#374151" }}>
                ตำแหน่ง
                <input name="position" defaultValue={fullUser.position ?? ""} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 500, color: "#374151" }}>
                หน่วยงาน
                <input name="department" defaultValue={fullUser.department ?? ""} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 500, color: "#374151" }}>
                อีเมล
                <input name="email" type="email" defaultValue={fullUser.email ?? ""} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 500, color: "#374151" }}>
                เบอร์โทรศัพท์
                <input name="phone" defaultValue={fullUser.phone ?? ""} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 500, color: "#374151" }}>
                เวรเริ่มต้น
                <select name="defaultShift" defaultValue={fullUser.defaultShift ?? ""} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "#fff" }}>
                  <option value="">ไม่ระบุ</option>
                  {SHIFT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
            </div>
            <button className="button" type="submit" style={{ fontSize: 13, padding: "8px 24px", borderRadius: 8 }}>บันทึกข้อมูล</button>
          </form>
        </div>
      </section>

      {/* Personal Dashboard */}
      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#1e293b" }}>สถิติเดือนปัจจุบัน</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 }}>
          <div style={{ padding: "14px 16px", background: "#f8fafc", borderRadius: 10, borderLeft: "3px solid #3b82f6" }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginBottom: 4 }}>บันทึกทั้งหมด</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1e293b" }}>{totalEntries} <span style={{ fontSize: 12, fontWeight: 400, color: "#64748b" }}>รายการ</span></div>
          </div>
          <div style={{ padding: "14px 16px", background: "#f8fafc", borderRadius: 10, borderLeft: "3px solid #8b5cf6" }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginBottom: 4 }}>VM Host</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>{vmCount}</div>
          </div>
          <div style={{ padding: "14px 16px", background: "#f8fafc", borderRadius: 10, borderLeft: "3px solid #10b981" }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginBottom: 4 }}>Host Server</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>{serverCount}</div>
          </div>
          <div style={{ padding: "14px 16px", background: "#f8fafc", borderRadius: 10, borderLeft: "3px solid #f59e0b" }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginBottom: 4 }}>Network Device</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>{networkCount}</div>
          </div>
          <div style={{ padding: "14px 16px", background: "#f8fafc", borderRadius: 10, borderLeft: "3px solid #ef4444" }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginBottom: 4 }}>Database</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>{backupCount}</div>
          </div>
        </div>
      </section>

      {/* Change Password */}
      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#1e293b" }}>เปลี่ยนรหัสผ่าน</h2>
        <p className="muted" style={{ marginBottom: 14 }}>ตั้งรหัสผ่านใหม่เพื่อความปลอดภัยของบัญชี</p>
        <form action={changePasswordAction} className="form-row">
          <input type="hidden" name="returnTo" value="/profile" />
          <label>
            รหัสผ่านปัจจุบัน
            <input name="currentPassword" type="password" required minLength={8} />
          </label>
          <label>
            รหัสผ่านใหม่
            <input name="newPassword" type="password" required minLength={8} />
          </label>
          <label>
            ยืนยันรหัสผ่านใหม่
            <input name="confirmPassword" type="password" required minLength={8} />
          </label>
          <div className="form-actions">
            <button className="button" type="submit">บันทึกรหัสผ่าน</button>
          </div>
        </form>
      </section>

      {/* 2FA Link */}
      <section className="card">
        <div className="toolbar">
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>ความปลอดภัย 2FA</h2>
            <p className="muted">เปิดใช้งาน Google Authenticator เพื่อเพิ่มความปลอดภัยในการเข้าสู่ระบบ</p>
          </div>
          <a className="button secondary" href="/security" style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8 }}>ไปยังหน้า 2FA</a>
        </div>
      </section>
    </AppShell>
  );
}
