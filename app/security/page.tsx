import { AppShell } from "@/components/AppShell";
import { createTwoFactorSetupAction, verifyTwoFactorAction } from "@/app/actions";
import { createTotpQrDataUrl } from "@/lib/totp";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export default async function SecurityPage(
  props: { searchParams: Promise<{ setup?: string; error?: string; enabled?: string }> }
) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const record = await prisma.user.findUnique({ where: { id: user.id } });
  const showSetup = searchParams.setup === "1" && record?.twoFactorSecret;
  const qr = showSetup
    ? await createTotpQrDataUrl(`otpauth://totp/${encodeURIComponent(process.env.TOTP_ISSUER ?? "App Data Center")}:${encodeURIComponent(user.username)}?secret=${record.twoFactorSecret}&issuer=${encodeURIComponent(process.env.TOTP_ISSUER ?? "App Data Center")}`)
    : null;

  return (
    <AppShell title="2FA Security" subtitle="เปิดใช้ Google Authenticator เพื่อเพิ่มความปลอดภัยบัญชี">
      <section className="card">
        <div className="toolbar">
          <div>
            <h2>Google Authenticator</h2>
            <p className="muted">สถานะปัจจุบัน: <span className={`badge ${user.twoFactorEnabled ? "" : "locked"}`}>{user.twoFactorEnabled ? "ENABLED" : "DISABLED"}</span></p>
          </div>
          <form action={createTwoFactorSetupAction}>
            <button className="button" type="submit">สร้าง QR สำหรับ 2FA</button>
          </form>
        </div>

        {searchParams.enabled ? <p style={{ color: "var(--accent)" }}>เปิดใช้ 2FA เรียบร้อยแล้ว</p> : null}
        {searchParams.error === "totp" ? <p style={{ color: "var(--danger)" }}>รหัส 2FA ไม่ถูกต้อง กรุณาลองใหม่</p> : null}

        {qr ? (
          <div className="grid grid-2">
            <div>
              <div className="qr">
                <img src={qr} alt="Google Authenticator QR code" width={220} height={220} />
              </div>
              <p className="muted">สแกน QR ด้วย Google Authenticator แล้วกรอกรหัส 6 หลักเพื่อยืนยัน</p>
            </div>
            <form className="card" action={verifyTwoFactorAction} style={{ boxShadow: "none" }}>
              <label>
                รหัส 6 หลัก
                <input name="token" inputMode="numeric" autoComplete="one-time-code" required />
              </label>
              <button className="button" type="submit" style={{ marginTop: 12 }}>ยืนยันและเปิดใช้ 2FA</button>
            </form>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
