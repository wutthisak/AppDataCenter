import { AppShell } from "@/components/AppShell";
import { createUserAction, deleteUserAction, resetUserPasswordAction, toggleUserAction, updateUserAction } from "@/app/actions";
import { UsersConfirmForm } from "@/components/UsersConfirmForm";
import { UsersToastManager } from "@/components/UsersToastManager";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import {
  CircleAlert,
  CircleCheckBig,
  CircleSlash,
  Clock3,
  KeyRound,
  Mail,
  MoreHorizontal,
  Pencil,
  RefreshCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserRoundPlus,
  UserX,
  Users,
  X
} from "lucide-react";

type UsersSearchParams = {
  q?: string;
  role?: string;
  status?: string;
  error?: string;
  updated?: string;
  add?: string;
  edit?: string;
  reset?: string;
  delete?: string;
  toggle?: string;
  active?: string;
};

function buildHref(basePath: string, params: Record<string, string | undefined>) {
  const url = new URL(basePath, "http://localhost");
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return `${url.pathname}${url.search}`;
}

function formatDateTime(date: Date) {
  return date.toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function normalize(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function getRoleLabel(role: "ADMIN" | "OPERATOR") {
  return role === "ADMIN" ? "ผู้ดูแลระบบ" : "ผู้ปฏิบัติงาน";
}

function getRoleTone(role: "ADMIN" | "OPERATOR") {
  return role === "ADMIN" ? "admin" : "operator";
}

function getUserStatus(user: { active: boolean; mustChangePassword: boolean }) {
  if (!user.active) return { key: "disabled", label: "ปิดใช้งาน", tone: "danger" };
  if (user.mustChangePassword) return { key: "locked", label: "รอเปลี่ยนรหัส", tone: "warning" };
  return { key: "active", label: "ใช้งานอยู่", tone: "success" };
}

function getUserInitials(name: string, username: string) {
  const trimmed = name.trim() || username.trim();
  if (!trimmed) return "?";
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

export default async function UsersAdminPage(props: { searchParams: Promise<UsersSearchParams> }) {
  const searchParams = await props.searchParams;
  const currentUser = await requireUser(["ADMIN"]);
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.active).length;
  const inactiveUsers = users.filter((u) => !u.active).length;
  const adminUsers = users.filter((u) => u.role === "ADMIN").length;
  const twoFactorUsers = users.filter((u) => u.twoFactorEnabled).length;

  const q = normalize(searchParams.q);
  const roleFilter = searchParams.role === "ADMIN" || searchParams.role === "OPERATOR" ? searchParams.role : "all";
  const statusFilter = searchParams.status === "active" || searchParams.status === "disabled" || searchParams.status === "locked" ? searchParams.status : "all";

  const currentHref = buildHref("/admin/users", {
    q: q || undefined,
    role: roleFilter === "all" ? undefined : roleFilter,
    status: statusFilter === "all" ? undefined : statusFilter
  });

  const addHref = buildHref(currentHref, { add: "1" });
  const editHref = (id: string) => buildHref(currentHref, { edit: id });
  const resetHref = (id: string) => buildHref(currentHref, { reset: id });
  const deleteHref = (id: string) => buildHref(currentHref, { delete: id });
  const toggleHref = (id: string, active: boolean) => buildHref(currentHref, { toggle: id, active: active ? "1" : "0" });

  const visibleUsers = users.filter((user) => {
    const status = getUserStatus(user);
    const queryMatch = !q || [user.displayName, user.username, user.email ?? ""].some((value) => normalize(value).includes(q));
    const roleMatch = roleFilter === "all" || user.role === roleFilter;
    const statusMatch = statusFilter === "all" || status.key === statusFilter;
    return queryMatch && roleMatch && statusMatch;
  });

  const editUser = searchParams.edit ? users.find((u) => u.id === searchParams.edit) : null;
  const resetUser = searchParams.reset ? users.find((u) => u.id === searchParams.reset) : null;
  const deleteUser = searchParams.delete ? users.find((u) => u.id === searchParams.delete) : null;
  const toggleUser = searchParams.toggle ? users.find((u) => u.id === searchParams.toggle) : null;
  const toggleTargetActive = searchParams.active === "1";

  return (
    <AppShell title="" hideTopbar>
      <UsersToastManager />

      <section className="users-page">
        <div className="users-command-panel">
          <div className="users-command-main">
            <p className="users-kicker">User Administration</p>
            <div className="users-command-title-row">
              <div>
                <h2>บัญชีผู้ใช้งาน</h2>
                <p>แสดง {visibleUsers.length} จาก {users.length} รายการ</p>
              </div>
              <Link href={addHref} className="users-primary-btn">
                <UserRoundPlus size={17} />
                เพิ่มผู้ใช้
              </Link>
            </div>
          </div>

          <form className="users-toolbar-filters" action="/admin/users" method="get">
            <label className="users-search-field">
              <Search size={16} />
              <input name="q" defaultValue={searchParams.q ?? ""} placeholder="ค้นหาชื่อ, username, email" aria-label="ค้นหาผู้ใช้งาน" />
            </label>

            <label className="users-select-field">
              <span>บทบาท</span>
              <select name="role" defaultValue={roleFilter} aria-label="กรองตามบทบาท">
                <option value="all">ทุกบทบาท</option>
                <option value="ADMIN">ผู้ดูแลระบบ</option>
                <option value="OPERATOR">ผู้ปฏิบัติงาน</option>
              </select>
            </label>

            <label className="users-select-field">
              <span>สถานะ</span>
              <select name="status" defaultValue={statusFilter} aria-label="กรองตามสถานะ">
                <option value="all">ทุกสถานะ</option>
                <option value="active">ใช้งานอยู่</option>
                <option value="disabled">ปิดใช้งาน</option>
                <option value="locked">รอเปลี่ยนรหัส</option>
              </select>
            </label>

            <button className="users-filter-submit" type="submit">
              <Search size={16} />
              กรอง
            </button>
            <Link href="/admin/users" className="users-filter-reset">
              <RefreshCcw size={16} />
              ล้าง
            </Link>
          </form>
        </div>

        <div className="users-summary-grid">
          <article className="users-summary-card users-summary-card--total">
            <div className="users-summary-icon"><Users size={22} /></div>
            <div>
              <div className="users-stat-label">ผู้ใช้ทั้งหมด</div>
              <div className="users-stat-value">{totalUsers}</div>
              <div className="users-stat-sub">บัญชีในระบบ</div>
            </div>
          </article>

          <article className="users-summary-card users-summary-card--active">
            <div className="users-summary-icon"><CircleCheckBig size={22} /></div>
            <div>
              <div className="users-stat-label">ใช้งานอยู่</div>
              <div className="users-stat-value">{activeUsers}</div>
              <div className="users-stat-sub">{totalUsers === 0 ? "ยังไม่มีบัญชี" : `${Math.round((activeUsers / totalUsers) * 100)}% ของทั้งหมด`}</div>
            </div>
          </article>

          <article className="users-summary-card users-summary-card--admin">
            <div className="users-summary-icon"><ShieldCheck size={22} /></div>
            <div>
              <div className="users-stat-label">ผู้ดูแลระบบ</div>
              <div className="users-stat-value">{adminUsers}</div>
              <div className="users-stat-sub">บัญชีสิทธิ์สูง</div>
            </div>
          </article>

          <article className="users-summary-card users-summary-card--danger">
            <div className="users-summary-icon"><CircleSlash size={22} /></div>
            <div>
              <div className="users-stat-label">ปิดใช้งาน</div>
              <div className="users-stat-value">{inactiveUsers}</div>
              <div className="users-stat-sub">{twoFactorUsers} บัญชีเปิด 2FA</div>
            </div>
          </article>
        </div>

        <div className="users-table-card">
          <div className="users-table-head">
            <div>
              <h2>รายชื่อผู้ใช้งาน</h2>
              <p>ตรวจสอบบทบาท สถานะ และจัดการบัญชีจากเมนูด้านขวา</p>
            </div>
            <div className="users-table-meta">
              {visibleUsers.length} / {users.length}
            </div>
          </div>

          {visibleUsers.length === 0 ? (
            <div className="users-empty-state">
              <div className="users-empty-icon"><Users size={30} /></div>
              <h3>ไม่พบผู้ใช้งาน</h3>
              <p>ลองล้างตัวกรองหรือเพิ่มบัญชีผู้ใช้ใหม่</p>
              <div className="users-empty-actions">
                <Link href="/admin/users" className="users-filter-reset">
                  <RefreshCcw size={16} />
                  ล้างตัวกรอง
                </Link>
                <Link href={addHref} className="users-primary-btn">
                  <UserRoundPlus size={16} />
                  เพิ่มผู้ใช้
                </Link>
              </div>
            </div>
          ) : (
            <div className="users-card-table">
              <div className="users-card-table-head">
                <span>ผู้ใช้งาน</span>
                <span>บทบาท</span>
                <span>สถานะ</span>
                <span>ความปลอดภัย</span>
                <span>จัดการ</span>
              </div>

              <div className="users-card-list">
                {visibleUsers.map((user) => {
                  const isSelf = user.id === currentUser.id;
                  const initials = getUserInitials(user.displayName, user.username);
                  const roleTone = getRoleTone(user.role);
                  const status = getUserStatus(user);
                  const avatarClass = status.key === "disabled"
                    ? "users-avatar users-avatar--inactive"
                    : user.role === "ADMIN"
                      ? "users-avatar users-avatar--admin"
                      : "users-avatar";

                  return (
                    <article className="users-row-card" key={user.id}>
                      <div className="users-row-cell users-row-user">
                        <div className={avatarClass}>{initials}</div>
                        <div className="users-user-stack">
                          <div className="users-user-title-line">
                            <span className="users-user-name">{user.displayName}</span>
                            {isSelf ? <span className="users-chip users-chip--self">คุณ</span> : null}
                          </div>
                          <div className="users-user-handle">@{user.username}</div>
                          <div className="users-user-email">
                            <Mail size={13} />
                            {user.email ?? "ไม่มีอีเมล"}
                          </div>
                        </div>
                      </div>

                      <div className="users-row-cell" data-label="บทบาท">
                        <span className={`users-role-badge users-role-badge--${roleTone}`}>
                          {getRoleLabel(user.role)}
                        </span>
                      </div>

                      <div className="users-row-cell" data-label="สถานะ">
                        <span className={`users-status-badge users-status-badge--${status.tone}`}>
                          {status.label}
                        </span>
                      </div>

                      <div className="users-row-cell users-row-security" data-label="ความปลอดภัย">
                        <div className="users-security-line">
                          {user.twoFactorEnabled ? <ShieldCheck size={14} /> : <CircleAlert size={14} />}
                          {user.twoFactorEnabled ? "เปิด 2FA" : "ยังไม่เปิด 2FA"}
                        </div>
                        <div className="users-created-line">
                          <Clock3 size={13} />
                          สร้างเมื่อ {formatDateTime(user.createdAt)}
                        </div>
                      </div>

                      <div className="users-row-cell users-row-actions">
                        <details className="users-action-dropdown">
                          <summary className="users-action-trigger" aria-label={`จัดการ ${user.displayName}`}>
                            <MoreHorizontal size={20} />
                          </summary>
                          <div className="users-action-menu">
                            <Link href={editHref(user.id)} className="users-action-item">
                              <Pencil size={15} />
                              แก้ไขผู้ใช้
                            </Link>
                            {!isSelf ? (
                              <Link href={resetHref(user.id)} className="users-action-item">
                                <KeyRound size={15} />
                                รีเซ็ตรหัสผ่าน
                              </Link>
                            ) : (
                              <span className="users-action-item users-action-item--disabled">
                                <KeyRound size={15} />
                                รีเซ็ตรหัสผ่าน
                              </span>
                            )}
                            {!isSelf ? (
                              <Link href={toggleHref(user.id, !user.active)} className="users-action-item">
                                {user.active ? <UserX size={15} /> : <UserCheck size={15} />}
                                {user.active ? "ปิดใช้งานบัญชี" : "เปิดใช้งานบัญชี"}
                              </Link>
                            ) : (
                              <span className="users-action-item users-action-item--disabled">
                                <UserX size={15} />
                                ปิดใช้งานบัญชี
                              </span>
                            )}
                            {!isSelf ? (
                              <Link href={deleteHref(user.id)} className="users-action-item users-action-item--danger">
                                <Trash2 size={15} />
                                ลบผู้ใช้
                              </Link>
                            ) : (
                              <span className="users-action-item users-action-item--disabled">
                                <Trash2 size={15} />
                                ลบผู้ใช้
                              </span>
                            )}
                          </div>
                        </details>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {searchParams.add === "1" ? (
        <div className="users-modal-overlay">
          <div className="users-modal-dialog">
            <div className="users-modal-header">
              <h2><UserRoundPlus size={19} /> เพิ่มผู้ใช้ใหม่</h2>
              <Link href={currentHref} className="users-modal-close" aria-label="ปิด">
                <X size={18} />
              </Link>
            </div>
            <UsersConfirmForm
              action={createUserAction}
              confirmTitle="ยืนยันการสร้างผู้ใช้"
              confirmDescription="ระบบจะสร้างบัญชีใหม่และบังคับให้ผู้ใช้เปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก"
              confirmButtonLabel="ยืนยันสร้างผู้ใช้"
              confirmTone="success"
            >
              <input type="hidden" name="returnTo" value={currentHref} />
              <div className="users-modal-body">
                <div className="users-modal-avatar-row">
                  <div className="users-modal-avatar"><UserRoundPlus size={28} /></div>
                  <div>
                    <div className="users-modal-title">ข้อมูลบัญชีใหม่</div>
                    <div className="users-modal-subtitle">กำหนด username, ชื่อแสดงผล, รหัสผ่าน และบทบาท</div>
                  </div>
                </div>
                <div className="users-modal-grid">
                  <label>
                    ชื่อผู้ใช้
                    <input name="username" required autoFocus placeholder="username" />
                  </label>
                  <label>
                    ชื่อแสดงผล
                    <input name="displayName" required placeholder="ชื่อผู้ใช้งาน" />
                  </label>
                  <label>
                    อีเมล
                    <input name="email" type="email" placeholder="name@datacenter.local" />
                  </label>
                  <label>
                    รหัสผ่าน
                    <input name="password" type="password" minLength={8} required placeholder="อย่างน้อย 8 ตัวอักษร" />
                  </label>
                  <label>
                    บทบาท
                    <select name="role" defaultValue="OPERATOR">
                      <option value="OPERATOR">ผู้ปฏิบัติงาน</option>
                      <option value="ADMIN">ผู้ดูแลระบบ</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="users-modal-footer">
                <Link href={currentHref} className="button secondary users-modal-cancel">ยกเลิก</Link>
                <button className="button" type="submit">
                  <UserRoundPlus size={16} />
                  สร้างผู้ใช้
                </button>
              </div>
            </UsersConfirmForm>
          </div>
        </div>
      ) : null}

      {editUser ? (
        <div className="users-modal-overlay">
          <div className="users-modal-dialog">
            <div className="users-modal-header">
              <h2><Pencil size={19} /> แก้ไขผู้ใช้</h2>
              <Link href={currentHref} className="users-modal-close" aria-label="ปิด">
                <X size={18} />
              </Link>
            </div>
            <UsersConfirmForm
              action={updateUserAction}
              confirmTitle="ยืนยันการบันทึก"
              confirmDescription={`ข้อมูลของ ${editUser.displayName} จะถูกอัปเดตตามค่าที่กรอกในฟอร์มนี้`}
              confirmButtonLabel="ยืนยันบันทึก"
              confirmTone="primary"
            >
              <input type="hidden" name="userId" value={editUser.id} />
              <input type="hidden" name="returnTo" value={currentHref} />
              <div className="users-modal-body">
                <div className="users-modal-avatar-row">
                  <div className={editUser.active ? "users-modal-avatar" : "users-modal-avatar users-modal-avatar--disabled"}>
                    {getUserInitials(editUser.displayName, editUser.username)}
                  </div>
                  <div>
                    <div className="users-modal-title">{editUser.displayName}</div>
                    <div className="users-modal-subtitle">@{editUser.username}</div>
                  </div>
                </div>
                <div className="users-modal-grid">
                  <label>
                    ชื่อแสดงผล
                    <input name="displayName" defaultValue={editUser.displayName} required autoFocus />
                  </label>
                  <label>
                    ชื่อผู้ใช้
                    <input value={editUser.username} readOnly />
                  </label>
                  <label>
                    อีเมล
                    <input name="email" type="email" defaultValue={editUser.email ?? ""} placeholder="name@datacenter.local" />
                  </label>
                  <label>
                    บทบาท
                    <select name="role" defaultValue={editUser.role}>
                      <option value="OPERATOR">ผู้ปฏิบัติงาน</option>
                      <option value="ADMIN">ผู้ดูแลระบบ</option>
                    </select>
                  </label>
                </div>
                <div className="users-modal-info-grid">
                  <span className={`users-chip ${editUser.active ? "users-chip--success" : "users-chip--danger"}`}>{editUser.active ? "ใช้งานอยู่" : "ปิดใช้งาน"}</span>
                  <span className={`users-chip ${editUser.twoFactorEnabled ? "users-chip--success" : "users-chip--muted"}`}>{editUser.twoFactorEnabled ? "เปิด 2FA" : "ปิด 2FA"}</span>
                  <span className={`users-chip ${editUser.mustChangePassword ? "users-chip--warning" : "users-chip--muted"}`}>{editUser.mustChangePassword ? "รอเปลี่ยนรหัส" : "พร้อมใช้งาน"}</span>
                </div>
              </div>
              <div className="users-modal-footer">
                <Link href={currentHref} className="button secondary users-modal-cancel">ยกเลิก</Link>
                <button className="button" type="submit">
                  <Pencil size={16} />
                  บันทึกการแก้ไข
                </button>
              </div>
            </UsersConfirmForm>
          </div>
        </div>
      ) : null}

      {resetUser ? (
        <div className="users-modal-overlay">
          <div className="users-modal-dialog users-modal-dialog--security">
            <div className="users-modal-header">
              <h2><KeyRound size={19} /> รีเซ็ตรหัสผ่าน</h2>
              <Link href={currentHref} className="users-modal-close" aria-label="ปิด">
                <X size={18} />
              </Link>
            </div>
            <UsersConfirmForm
              action={resetUserPasswordAction}
              confirmTitle="ยืนยันการรีเซ็ตรหัสผ่าน"
              confirmDescription={`${resetUser.displayName} จะต้องเปลี่ยนรหัสผ่านใหม่ในการเข้าสู่ระบบครั้งถัดไป`}
              confirmButtonLabel="ยืนยันรีเซ็ต"
              confirmTone="warning"
            >
              <input type="hidden" name="userId" value={resetUser.id} />
              <input type="hidden" name="returnTo" value={currentHref} />
              <div className="users-modal-body">
                <div className="users-security-hero">
                  <div className="users-security-icon"><KeyRound size={26} /></div>
                  <div>
                    <div className="users-modal-title">ตั้งรหัสผ่านใหม่</div>
                    <div className="users-modal-subtitle">{resetUser.displayName} (@{resetUser.username})</div>
                  </div>
                </div>
                <label className="users-full-field">
                  รหัสผ่านใหม่
                  <input name="password" type="password" minLength={8} required autoFocus placeholder="อย่างน้อย 8 ตัวอักษร" />
                </label>
                <div className="users-security-hint">
                  หลังรีเซ็ต ระบบจะตั้งสถานะให้ผู้ใช้เปลี่ยนรหัสผ่านเองเมื่อเข้าสู่ระบบ
                </div>
              </div>
              <div className="users-modal-footer">
                <Link href={currentHref} className="button secondary users-modal-cancel">ยกเลิก</Link>
                <button className="button" type="submit">
                  <KeyRound size={16} />
                  รีเซ็ตรหัสผ่าน
                </button>
              </div>
            </UsersConfirmForm>
          </div>
        </div>
      ) : null}

      {deleteUser ? (
        <div className="users-modal-overlay">
          <div className="users-modal-dialog users-modal-dialog--danger">
            <div className="users-modal-header">
              <h2><Trash2 size={19} /> ลบผู้ใช้</h2>
              <Link href={currentHref} className="users-modal-close" aria-label="ปิด">
                <X size={18} />
              </Link>
            </div>
            <UsersConfirmForm
              action={deleteUserAction}
              confirmTitle="ยืนยันการลบผู้ใช้"
              confirmDescription={`บัญชี ${deleteUser.displayName} จะถูกลบถาวร หลังจากยืนยันแล้วจะย้อนกลับไม่ได้`}
              confirmButtonLabel="ยืนยันลบผู้ใช้"
              confirmTone="danger"
            >
              <input type="hidden" name="userId" value={deleteUser.id} />
              <input type="hidden" name="returnTo" value={currentHref} />
              <div className="users-modal-body">
                <div className="users-delete-hero">
                  <div className="users-delete-icon"><Trash2 size={28} /></div>
                  <div>
                    <div className="users-modal-title">ลบบัญชีถาวร</div>
                    <div className="users-modal-subtitle">พิมพ์ username เพื่อยืนยันก่อนลบ</div>
                  </div>
                </div>
                <div className="users-delete-warning">
                  <strong>{deleteUser.displayName}</strong> (@{deleteUser.username}) จะถูกลบออกจากระบบและข้อมูลที่เกี่ยวข้องจะถูกจัดการตามเงื่อนไขของฐานข้อมูล
                </div>
                <label className="users-full-field">
                  ยืนยัน username
                  <input name="confirmUsername" placeholder={deleteUser.username} required autoFocus />
                </label>
              </div>
              <div className="users-modal-footer">
                <Link href={currentHref} className="button secondary users-modal-cancel">ยกเลิก</Link>
                <button className="button danger" type="submit">
                  <Trash2 size={16} />
                  ลบผู้ใช้
                </button>
              </div>
            </UsersConfirmForm>
          </div>
        </div>
      ) : null}

      {toggleUser ? (
        <div className="users-modal-overlay">
          <div className="users-modal-dialog">
            <div className="users-modal-header">
              <h2>
                {toggleTargetActive ? <UserCheck size={19} /> : <UserX size={19} />}
                {toggleTargetActive ? "เปิดใช้งานผู้ใช้" : "ปิดใช้งานผู้ใช้"}
              </h2>
              <Link href={currentHref} className="users-modal-close" aria-label="ปิด">
                <X size={18} />
              </Link>
            </div>
            <UsersConfirmForm
              action={toggleUserAction}
              confirmTitle={toggleTargetActive ? "ยืนยันการเปิดใช้งาน" : "ยืนยันการปิดใช้งาน"}
              confirmDescription={
                toggleTargetActive
                  ? `${toggleUser.displayName} จะกลับมาเข้าสู่ระบบได้ทันที`
                  : `${toggleUser.displayName} จะไม่สามารถเข้าสู่ระบบได้จนกว่าจะเปิดใช้งานอีกครั้ง`
              }
              confirmButtonLabel={toggleTargetActive ? "ยืนยันเปิดใช้งาน" : "ยืนยันปิดใช้งาน"}
              confirmTone={toggleTargetActive ? "success" : "danger"}
            >
              <input type="hidden" name="userId" value={toggleUser.id} />
              <input type="hidden" name="active" value={toggleTargetActive ? "true" : "false"} />
              <input type="hidden" name="returnTo" value={currentHref} />
              <div className="users-modal-body">
                <div className="users-toggle-hero">
                  <div className={toggleTargetActive ? "users-toggle-icon users-toggle-icon--success" : "users-toggle-icon users-toggle-icon--danger"}>
                    {toggleTargetActive ? <UserCheck size={26} /> : <ShieldAlert size={26} />}
                  </div>
                  <div>
                    <div className="users-modal-title">{toggleTargetActive ? "เปิดใช้งานบัญชี" : "ปิดใช้งานบัญชี"}</div>
                    <div className="users-modal-subtitle">{toggleUser.displayName} (@{toggleUser.username})</div>
                  </div>
                </div>
                <p className="users-modal-text">
                  {toggleTargetActive
                    ? "บัญชีนี้จะกลับมาใช้งานได้ทันทีหลังยืนยัน"
                    : "ผู้ใช้จะถูกระงับการเข้าสู่ระบบ แต่ข้อมูลบัญชียังอยู่ในระบบ"}
                </p>
              </div>
              <div className="users-modal-footer">
                <Link href={currentHref} className="button secondary users-modal-cancel">ยกเลิก</Link>
                <button className={`button ${toggleTargetActive ? "" : "danger"}`} type="submit">
                  {toggleTargetActive ? <UserCheck size={16} /> : <UserX size={16} />}
                  {toggleTargetActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                </button>
              </div>
            </UsersConfirmForm>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
