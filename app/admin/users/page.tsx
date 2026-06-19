import { AppShell } from "@/components/AppShell";
import { createUserAction, toggleUserAction } from "@/app/actions";
import { roleLabels } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export default async function UsersAdminPage(props: { searchParams: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;
  await requireUser(["ADMIN"]);
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <AppShell title="จัดการผู้ใช้งาน" subtitle="จัดการผู้ใช้และสิทธิ์การเข้าใช้งาน">
      <section className="card" style={{ marginBottom: 18 }}>
        <h2>เพิ่มผู้ใช้</h2>
        {searchParams.error === "invalid" ? <p style={{ color: "var(--danger)" }}>กรุณากรอกข้อมูลให้ครบ และรหัสผ่านอย่างน้อย 8 ตัวอักษร</p> : null}
        {searchParams.error === "self" ? <p style={{ color: "var(--danger)" }}>ไม่สามารถปิดใช้งานบัญชีตัวเองได้</p> : null}
        <form className="form-row" action={createUserAction} style={{ marginTop: 14 }}>
          <label>
            Username
            <input name="username" required />
          </label>
          <label>
            ชื่อแสดงผล
            <input name="displayName" required />
          </label>
          <label>
            Password
            <input name="password" type="password" minLength={8} required />
          </label>
          <label>
            Role
            <select name="role" defaultValue="OPERATOR">
              <option value="OPERATOR">ผู้ปฏิบัติงาน</option>
              <option value="ADMIN">ผู้ดูแลระบบ</option>
            </select>
          </label>
          <button className="button" type="submit">สร้างผู้ใช้</button>
        </form>
      </section>

      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>ชื่อ</th>
                <th>Role</th>
                <th>2FA</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.displayName}</td>
                  <td>{roleLabels[user.role]}</td>
                  <td>{user.twoFactorEnabled ? "เปิดใช้" : "-"}</td>
                  <td><span className={`badge ${user.active ? "" : "locked"}`}>{user.active ? "ACTIVE" : "INACTIVE"}</span></td>
                  <td>
                    <form action={toggleUserAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="active" value={user.active ? "false" : "true"} />
                      <button className={`button ${user.active ? "danger" : "secondary"}`} type="submit">
                        {user.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
