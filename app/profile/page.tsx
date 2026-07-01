import type { ReactNode } from "react";
import {
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleAlert,
  KeyRound,
  LockKeyhole,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  UserRound
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ForcePasswordReset } from "@/components/ForcePasswordReset";
import { changePasswordAction, createTwoFactorSetupAction, updateProfileAction, verifyTwoFactorAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { createTotpQrDataUrl } from "@/lib/totp";
import { roleLabels } from "@/lib/constants";
import { prisma } from "@/lib/prisma";


const errorMessages: Record<string, string> = {
  invalid: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง",
  wrong: "รหัสผ่านปัจจุบันไม่ถูกต้อง"
};

export default async function ProfilePage(props: { searchParams: Promise<{ updated?: string; error?: string; forcePassword?: string; setup?: string; enabled?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser(undefined, { allowPasswordChange: true });

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      position: true,
      department: true,
      email: true,
      phone: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      mustChangePassword: true
    }
  });
  if (!fullUser) return null;

  const isForced = fullUser.mustChangePassword || searchParams.forcePassword === "1";
  if (isForced) {
    return <ForcePasswordReset error={searchParams.error} updated={searchParams.updated} />;
  }

  const updatedMessage = searchParams.updated === "profile"
    ? "บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว"
    : searchParams.updated
      ? "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว"
      : null;
  const errorMessage = searchParams.error ? errorMessages[searchParams.error] ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" : null;
  const initials = fullUser.displayName.trim().charAt(0).toUpperCase() || "U";
  const showTwoFactorSetup = searchParams.setup === "1" && fullUser.twoFactorSecret;
  const qr = showTwoFactorSetup
    ? await createTotpQrDataUrl(`otpauth://totp/${encodeURIComponent(process.env.TOTP_ISSUER ?? "App Data Center")}:${encodeURIComponent(fullUser.username)}?secret=${fullUser.twoFactorSecret}&issuer=${encodeURIComponent(process.env.TOTP_ISSUER ?? "App Data Center")}`)
    : null;

  return (
    <AppShell title="โปรไฟล์ของฉัน" subtitle="จัดการข้อมูลส่วนตัว ความปลอดภัย และภาพรวมงานของบัญชี" hideTopbar>
      <section className="profile-page">
        {updatedMessage ? (
          <div className="profile-toast profile-toast--success">
            <CheckCircle2 size={18} />
            {updatedMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="profile-toast profile-toast--error">
            <CircleAlert size={18} />
            {errorMessage}
          </div>
        ) : null}
        {searchParams.enabled ? (
          <div className="profile-toast profile-toast--success">
            <CheckCircle2 size={18} />
            เปิดใช้ 2FA เรียบร้อยแล้ว
          </div>
        ) : null}
        {searchParams.error === "totp" ? (
          <div className="profile-toast profile-toast--error">
            <CircleAlert size={18} />
            รหัส 2FA ไม่ถูกต้อง กรุณาลองใหม่
          </div>
        ) : null}

        <div className="profile-hero">
          <div className="profile-avatar">{initials}</div>
          <div className="profile-hero-main">
            <p className="profile-kicker">Account Profile</p>
            <h2>{fullUser.displayName}</h2>
            <div className="profile-meta-line">
              <span>{roleLabels[fullUser.role]}</span>
              <span>@{fullUser.username}</span>
            </div>
          </div>
          <div className={`profile-security-pill ${fullUser.twoFactorEnabled ? "is-enabled" : "is-warning"}`}>
            <ShieldCheck size={17} />
            {fullUser.twoFactorEnabled ? "2FA เปิดใช้งาน" : "ยังไม่เปิด 2FA"}
          </div>
        </div>

        <div className="profile-overview-grid">
          <InfoTile icon={<BriefcaseBusiness size={20} />} label="ตำแหน่ง" value={fullUser.position || "ยังไม่ได้ระบุ"} />
          <InfoTile icon={<Building2 size={20} />} label="หน่วยงาน" value={fullUser.department || "ยังไม่ได้ระบุ"} />
          <InfoTile icon={<Mail size={20} />} label="อีเมล" value={fullUser.email || "ยังไม่ได้ระบุ"} />
          <InfoTile icon={<Phone size={20} />} label="โทรศัพท์" value={fullUser.phone || "ยังไม่ได้ระบุ"} />
        </div>

        <div className="profile-layout">
          <section className="profile-card profile-card--main">
            <SectionHeader
              icon={<UserRound size={20} />}
              title="ข้อมูลโปรไฟล์"
              description="อัปเดตข้อมูลติดต่อสำหรับบัญชีผู้ใช้งาน"
            />
            <form action={updateProfileAction}>
              <input type="hidden" name="returnTo" value="/profile" />
              <div className="profile-form-grid">
                <label className="profile-field">
                  <span>ชื่อ-สกุล</span>
                  <input name="displayName" defaultValue={fullUser.displayName} required placeholder="ชื่อ-สกุลของคุณ" />
                </label>
                <label className="profile-field">
                  <span>ตำแหน่ง</span>
                  <input name="position" defaultValue={fullUser.position ?? ""} placeholder="เช่น นักวิชาการคอมพิวเตอร์" />
                </label>
                <label className="profile-field">
                  <span>หน่วยงาน</span>
                  <input name="department" defaultValue={fullUser.department ?? ""} placeholder="ชื่อหน่วยงาน" />
                </label>
                <label className="profile-field">
                  <span>อีเมล</span>
                  <input name="email" type="email" defaultValue={fullUser.email ?? ""} placeholder="email@example.com" />
                </label>
                <label className="profile-field">
                  <span>เบอร์โทรศัพท์</span>
                  <input name="phone" defaultValue={fullUser.phone ?? ""} placeholder="099-xxx-xxxx" />
                </label>
              </div>
              <div className="profile-form-actions">
                <button className="profile-button profile-button--primary" type="submit">
                  <Save size={16} />
                  บันทึกโปรไฟล์
                </button>
              </div>
            </form>
          </section>

          <aside className="profile-side-stack">
            <section className="profile-card">
              <SectionHeader
                icon={<LockKeyhole size={20} />}
                title="เปลี่ยนรหัสผ่าน"
                description="ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษรเพื่อความปลอดภัย"
              />
              <form action={changePasswordAction}>
                <input type="hidden" name="returnTo" value="/profile" />
                <div className="profile-password-grid">
                  <label className="profile-field">
                    <span>รหัสผ่านปัจจุบัน</span>
                    <input name="currentPassword" type="password" required minLength={8} placeholder="รหัสผ่านปัจจุบัน" />
                  </label>
                  <label className="profile-field">
                    <span>รหัสผ่านใหม่</span>
                    <input name="newPassword" type="password" required minLength={8} placeholder="อย่างน้อย 8 ตัวอักษร" />
                  </label>
                  <label className="profile-field">
                    <span>ยืนยันรหัสผ่านใหม่</span>
                    <input name="confirmPassword" type="password" required minLength={8} placeholder="กรอกซ้ำอีกครั้ง" />
                  </label>
                </div>
                <div className="profile-form-actions">
                  <button className="profile-button profile-button--primary" type="submit">
                    <KeyRound size={16} />
                    บันทึกรหัสผ่าน
                  </button>
                </div>
              </form>
            </section>

            <section className="profile-card profile-card--security">
              <SectionHeader
                icon={<ShieldCheck size={20} />}
                title="ความปลอดภัย 2FA"
                description="สแกน QR ด้วย Google Authenticator และยืนยันรหัสในหน้านี้"
              />
              <div className={`profile-2fa-status ${fullUser.twoFactorEnabled ? "is-enabled" : "is-warning"}`}>
                <ShieldCheck size={18} />
                <div>
                  <strong>{fullUser.twoFactorEnabled ? "เปิดใช้งานแล้ว" : "ยังไม่เปิดใช้งาน"}</strong>
                  <span>{fullUser.twoFactorEnabled ? "บัญชีนี้ต้องใช้รหัส 2FA ตอนเข้าสู่ระบบ" : "แนะนำให้เปิดใช้เพื่อเพิ่มความปลอดภัย"}</span>
                </div>
              </div>
              <form action={createTwoFactorSetupAction}>
                <input type="hidden" name="returnTo" value="/profile" />
                <button className="profile-button profile-button--secondary" type="submit">
                  {fullUser.twoFactorEnabled ? "สร้าง QR ใหม่" : "สร้าง QR สำหรับ 2FA"}
                </button>
              </form>
            </section>
          </aside>
        </div>

        {qr ? (
          <div className="profile-2fa-modal" role="dialog" aria-modal="true" aria-labelledby="profile-2fa-title">
            <div className="profile-2fa-dialog">
              <div className="profile-2fa-dialog-head">
                <div>
                  <p className="profile-kicker">Two-Factor Authentication</p>
                  <h3 id="profile-2fa-title">สแกน QR เพื่อเปิดใช้ 2FA</h3>
                  <p>เปิด Google Authenticator แล้วสแกน QR นี้ จากนั้นกรอกรหัส 6 หลักเพื่อยืนยัน</p>
                </div>
                <a className="profile-2fa-close" href="/profile" aria-label="ปิดหน้าต่าง 2FA">×</a>
              </div>

              <div className="profile-2fa-dialog-body">
                <div className="profile-2fa-qr-panel">
                  <div className="profile-2fa-qr">
                    <img src={qr} alt="Google Authenticator QR code" width={220} height={220} />
                  </div>
                  <div className="profile-2fa-steps">
                    <span>1. เปิด Google Authenticator</span>
                    <span>2. เลือกเพิ่มบัญชีใหม่</span>
                    <span>3. สแกน QR และกรอกรหัสยืนยัน</span>
                  </div>
                </div>

                <form className="profile-2fa-verify" action={verifyTwoFactorAction}>
                  <input type="hidden" name="returnTo" value="/profile" />
                  <label className="profile-field">
                    <span>รหัส 6 หลัก</span>
                    <input name="token" inputMode="numeric" autoComplete="one-time-code" required placeholder="000000" />
                  </label>
                  <button className="profile-button profile-button--primary" type="submit">
                    <ShieldCheck size={16} />
                    ยืนยันและเปิดใช้ 2FA
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}

function SectionHeader({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="profile-section-header">
      <div className="profile-section-icon">{icon}</div>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <article className="profile-info-tile">
      <div className="profile-info-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
