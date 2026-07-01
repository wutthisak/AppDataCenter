"use client";

import { useRef, useState, useTransition } from "react";
import { loginAction } from "@/app/actions";

// ── Animated background nodes (lightweight SVG dots + lines) ──────────────────
function NetworkCanvas() {
  return (
    <svg
      className="login-canvas"
      viewBox="0 0 900 700"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Connection lines */}
      <g stroke="rgba(165,243,252,0.18)" strokeWidth="1">
        <line x1="120" y1="160" x2="320" y2="280" />
        <line x1="320" y1="280" x2="500" y2="180" />
        <line x1="500" y1="180" x2="700" y2="300" />
        <line x1="700" y1="300" x2="780" y2="500" />
        <line x1="320" y1="280" x2="240" y2="450" />
        <line x1="240" y1="450" x2="420" y2="540" />
        <line x1="420" y1="540" x2="600" y2="480" />
        <line x1="600" y1="480" x2="700" y2="300" />
        <line x1="120" y1="160" x2="200" y2="60" />
        <line x1="500" y1="180" x2="580" y2="60" />
        <line x1="780" y1="500" x2="860" y2="400" />
        <line x1="420" y1="540" x2="360" y2="640" />
      </g>
      {/* Nodes */}
      <g fill="rgba(125,211,252,0.55)">
        <circle cx="120" cy="160" r="5" className="login-node login-node--1" />
        <circle cx="320" cy="280" r="7" className="login-node login-node--2" />
        <circle cx="500" cy="180" r="5" className="login-node login-node--3" />
        <circle cx="700" cy="300" r="6" className="login-node login-node--4" />
        <circle cx="780" cy="500" r="4" className="login-node login-node--5" />
        <circle cx="240" cy="450" r="5" className="login-node login-node--1" />
        <circle cx="420" cy="540" r="7" className="login-node login-node--3" />
        <circle cx="600" cy="480" r="4" className="login-node login-node--2" />
        <circle cx="200" cy="60"  r="4" className="login-node login-node--4" />
        <circle cx="580" cy="60"  r="5" className="login-node login-node--5" />
        <circle cx="860" cy="400" r="4" className="login-node login-node--1" />
        <circle cx="360" cy="640" r="5" className="login-node login-node--3" />
      </g>
      {/* Data-flow pulses */}
      <circle r="3" fill="rgba(34,211,238,0.8)" className="login-pulse login-pulse--a">
        <animateMotion dur="4s" repeatCount="indefinite">
          <mpath href="#path-a" />
        </animateMotion>
      </circle>
      <circle r="2.5" fill="rgba(99,102,241,0.85)" className="login-pulse">
        <animateMotion dur="5.5s" repeatCount="indefinite" begin="1.5s">
          <mpath href="#path-b" />
        </animateMotion>
      </circle>
      <defs>
        <path id="path-a" d="M120,160 L320,280 L500,180 L700,300 L780,500" />
        <path id="path-b" d="M580,60 L500,180 L320,280 L240,450 L420,540 L600,480" />
      </defs>
      {/* Server rack icon (simplified) */}
      <g transform="translate(60,380)" opacity="0.22" fill="none" stroke="rgba(165,243,252,1)" strokeWidth="1.4">
        <rect x="0" y="0" width="44" height="60" rx="4" />
        <rect x="4" y="6" width="36" height="8" rx="2" />
        <rect x="4" y="18" width="36" height="8" rx="2" />
        <rect x="4" y="30" width="36" height="8" rx="2" />
        <circle cx="38" cy="10" r="2" fill="rgba(34,211,238,0.8)" stroke="none" />
        <circle cx="38" cy="22" r="2" fill="rgba(34,211,238,0.8)" stroke="none" />
        <circle cx="38" cy="34" r="2" fill="rgba(165,243,252,0.6)" stroke="none" />
      </g>
      {/* Database icon */}
      <g transform="translate(800,120)" opacity="0.2" fill="none" stroke="rgba(165,243,252,1)" strokeWidth="1.4">
        <ellipse cx="24" cy="10" rx="22" ry="8" />
        <path d="M2,10 Q2,24 24,24 Q46,24 46,10" />
        <path d="M2,17 Q2,31 24,31 Q46,31 46,17" />
      </g>
      {/* Cloud icon */}
      <g transform="translate(350,30)" opacity="0.18" fill="rgba(165,243,252,0.3)" stroke="rgba(165,243,252,1)" strokeWidth="1.2">
        <path d="M50,22 a14,14 0 0 0-14-14 a14,14 0 0 0-27,6 a10,10 0 0 0 2,20 h39 a10,10 0 0 0 0-12z" />
      </g>
    </svg>
  );
}

// ── Client Login Form with show/hide password ─────────────────────────────────
function LoginForm({ error }: { error: string | null }) {
  const [showPass,    setShowPass]    = useState(false);
  const [isPending,   startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await loginAction(fd);
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="login-form" noValidate>
      {/* Username */}
      <div className="login-field">
        <label htmlFor="lf-username">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          ชื่อผู้ใช้
        </label>
        <div className="login-input-wrap">
          <input
            id="lf-username"
            name="username"
            autoComplete="username"
            autoFocus
            required
            placeholder="กรอกชื่อผู้ใช้"
            disabled={isPending}
          />
        </div>
      </div>

      {/* Password */}
      <div className="login-field">
        <label htmlFor="lf-password">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          รหัสผ่าน
        </label>
        <div className="login-input-wrap login-input-wrap--pw">
          <input
            id="lf-password"
            name="password"
            type={showPass ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="กรอกรหัสผ่าน"
            disabled={isPending}
          />
          <button
            type="button"
            className="login-pw-toggle"
            onClick={() => setShowPass((v) => !v)}
            aria-label={showPass ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            tabIndex={0}
          >
            {showPass ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* 2FA */}
      <div className="login-field login-field--totp">
        <label htmlFor="lf-token">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
          Google Authenticator
        </label>
        <div className="login-input-wrap">
          <input
            id="lf-token"
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="รหัส 2FA (ถ้ามี)"
            disabled={isPending}
          />
        </div>
        <p className="login-field-hint">กรอกเฉพาะบัญชีที่เปิดใช้งาน Two-Factor Authentication</p>
      </div>

      {/* Error */}
      {error && (
        <div className="login-error" role="alert">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>{error}</span>
        </div>
      )}

      {/* Submit */}
      <button className="login-btn" type="submit" disabled={isPending}>
        {isPending ? (
          <>
            <span className="login-btn-spinner" aria-hidden="true" />
            <span>กำลังเข้าสู่ระบบ...</span>
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            <span>เข้าสู่ระบบ</span>
          </>
        )}
      </button>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const errorParam = (searchParams as any)?.error;
  const error =
    errorParam === "invalid"
      ? "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
      : errorParam === "totp"
        ? "กรุณากรอกรหัส 2FA จาก Google Authenticator ให้ถูกต้อง"
        : null;

  return (
    <main className="lp-root" aria-label="Infrastructure Operations Center Login">
      {/* ── LEFT PANEL ── */}
      <div className="lp-hero" aria-hidden="true">
        <NetworkCanvas />

        {/* Floating glows */}
        <div className="lp-glow lp-glow--1" />
        <div className="lp-glow lp-glow--2" />
        <div className="lp-glow lp-glow--3" />

        {/* Brand */}
        <div className="lp-hero-content">
          <div className="lp-logo-mark">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <rect x="4" y="8" width="40" height="8" rx="3" fill="rgba(125,211,252,0.9)" />
              <rect x="4" y="20" width="40" height="8" rx="3" fill="rgba(125,211,252,0.7)" />
              <rect x="4" y="32" width="40" height="8" rx="3" fill="rgba(125,211,252,0.5)" />
              <circle cx="38" cy="12" r="2.5" fill="#22d3ee" />
              <circle cx="38" cy="24" r="2.5" fill="#22d3ee" />
              <circle cx="38" cy="36" r="2.5" fill="rgba(34,211,238,0.5)" />
            </svg>
          </div>
          <div className="lp-hero-brand">
            <p className="lp-hero-eyebrow">Infrastructure Operations Center</p>
            <h1 className="lp-hero-title">ศูนย์ปฏิบัติการและติดตาม<br />โครงสร้างพื้นฐาน IT</h1>
            <p className="lp-hero-desc">
              ติดตาม ตรวจสอบ และบริหารจัดการ Data Center, Server, Virtualization,
              Network, Database, Backup และสภาพแวดล้อม ผ่านศูนย์กลางการปฏิบัติงานเดียว
            </p>
          </div>

          {/* Status chips */}
          <div className="lp-chips">
            <div className="lp-chip">
              <span className="lp-chip-dot lp-chip-dot--green" />
              <span>System Online</span>
            </div>
            <div className="lp-chip">
              <span className="lp-chip-dot lp-chip-dot--blue" />
              <span>2FA Ready</span>
            </div>
            <div className="lp-chip">
              <span className="lp-chip-dot lp-chip-dot--violet" />
              <span>Secure Access</span>
            </div>
          </div>

          {/* Infrastructure icons strip */}
          <div className="lp-infra-strip">
            {[
              { label: "Data Center",   icon: "🏢" },
              { label: "Virtualization",icon: "🖥" },
              { label: "Network",       icon: "🔗" },
              { label: "Database",      icon: "🗄" },
              { label: "Backup",        icon: "💾" },
              { label: "Environment",   icon: "🌡" },
            ].map((item) => (
              <div key={item.label} className="lp-infra-item">
                <span className="lp-infra-icon">{item.icon}</span>
                <span className="lp-infra-label">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="lp-right">
        <div className="lp-card" role="region" aria-labelledby="lp-heading">
          {/* Card header */}
          <div className="lp-card-header">
            <div className="lp-card-logo">
              <svg width="22" height="22" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <rect x="4" y="8"  width="40" height="8" rx="3" fill="#2563eb" />
                <rect x="4" y="20" width="40" height="8" rx="3" fill="#6366f1" />
                <rect x="4" y="32" width="40" height="8" rx="3" fill="#0891b2" />
                <circle cx="38" cy="12" r="2.5" fill="#22d3ee" />
                <circle cx="38" cy="24" r="2.5" fill="#818cf8" />
                <circle cx="38" cy="36" r="2.5" fill="#67e8f9" />
              </svg>
            </div>
            <div>
              <p className="lp-card-eyebrow">Infrastructure Operations Center</p>
              <h2 id="lp-heading" className="lp-card-title">เข้าสู่ระบบ</h2>
              <p className="lp-card-sub">ศูนย์ปฏิบัติการและติดตามโครงสร้างพื้นฐานระบบสารสนเทศ</p>
            </div>
          </div>

          {/* Form (client component) */}
          <LoginForm error={error} />

          {/* Footer */}
          <footer className="lp-card-footer">
            <div className="lp-card-footer-logo">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span>Infrastructure Operations Center</span>
            </div>
            <p className="lp-card-footer-copy">
              v1.0 &nbsp;·&nbsp; &copy; {new Date().getFullYear()} โรงพยาบาลสรรพสิทธิประสงค์<br />
              กลุ่มภารกิจสุขภาพดิจิทัล
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}