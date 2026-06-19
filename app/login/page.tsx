import { loginAction } from "@/app/actions";

export default async function LoginPage(props: { searchParams: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;
  const error =
    searchParams.error === "invalid"
      ? "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
      : searchParams.error === "totp"
        ? "กรุณากรอกรหัส 2FA จาก Google Authenticator ให้ถูกต้อง"
        : null;

  return (
    <main className="login-page">
      <section className="login-card">
        {/* Brand / Logo */}
        <div className="login-brand">
          <div className="login-logo">🏢</div>
          <h1 className="login-title">Data Center Operations</h1>
          <p className="login-subtitle">Data Center Operations Management System</p>
        </div>

        {/* Login Form */}
        <form action={loginAction} className="login-form">
          <div className="login-field">
            <label htmlFor="username">👤 Username</label>
            <input id="username" name="username" autoComplete="username" required placeholder="กรอกชื่อผู้ใช้" />
          </div>
          <div className="login-field">
            <label htmlFor="password">🔒 Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required placeholder="กรอกรหัสผ่าน" />
          </div>
          <div className="login-field">
            <label htmlFor="token">🔐 Google Authenticator</label>
            <input id="token" name="token" inputMode="numeric" autoComplete="one-time-code" placeholder="กรอกเมื่อเปิดใช้ 2FA แล้ว (ไม่บังคับ)" />
          </div>
          {error ? <p className="login-error">{error}</p> : null}
          <button className="login-btn" type="submit">เข้าสู่ระบบ</button>
        </form>

        {/* Footer */}
        <p className="login-footer">© 2025 IT Department — Data Center Operations</p>
      </section>
    </main>
  );
}
