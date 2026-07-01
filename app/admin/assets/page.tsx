import { AppShell } from "@/components/AppShell";
import { addAssetAction, toggleAssetAction, updateAssetAction } from "@/app/actions";
import { assetAccountLabels } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isGeneratedBackupJobAssetCode } from "@/lib/assets";

export default async function AssetsAdminPage() {
  await requireUser(["ADMIN"]);
  const categories = await prisma.assetCategory.findMany({
    orderBy: { displayOrder: "asc" },
    include: { assets: { orderBy: { displayOrder: "asc" } } }
  });
  const visibleCategories = categories.map((category) => ({
    ...category,
    assets: category.code === "BACKUP"
      ? category.assets.filter((asset) => !isGeneratedBackupJobAssetCode(asset.code))
      : category.assets,
  }));

  return (
    <AppShell title="จัดการบัญชีทรัพย์สิน" subtitle="เพิ่ม ปิดใช้งาน และจัดการรายการ VM / Host / Network / Backup">
      <div className="grid">
        {visibleCategories.map((category) => (
          <section className="card" key={category.id}>
            <div className="toolbar">
              <div>
                <h2>{assetAccountLabels[category.code]}</h2>
                <p className="muted">{category.assets.filter((asset) => asset.active).length} active / {category.assets.length} total</p>
              </div>
              <form className="form-row" action={addAssetAction}>
                <input type="hidden" name="categoryId" value={category.id} />
                <input type="hidden" name="returnTo" value="/admin/assets" />
                <label>
                  ชื่อ
                  <input name="name" placeholder="ชื่อรายการ" required />
                </label>
                <label>
                  รุ่น
                  <input name="model" placeholder="รุ่น" />
                </label>
                <label>
                  เลขครุภัณฑ์
                  <input name="assetNumber" placeholder="เลขครุภัณฑ์" />
                </label>
                <button className="button" type="submit">เพิ่ม</button>
              </form>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>ลำดับ</th>
                    <th>ชื่อ</th>
                    <th>รุ่น</th>
                    <th>เลขครุภัณฑ์</th>
                    <th>สถานะ</th>
                    <th style={{ width: 260 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {category.assets.map((asset) => (
                    <tr key={asset.id}>
                      <td>{asset.displayOrder}</td>
                      <td>{asset.name}</td>
                      <td>{asset.model ?? "-"}</td>
                      <td>{asset.assetNumber ?? "-"}</td>
                      <td><span className={`badge ${asset.active ? "" : "locked"}`}>{asset.active ? "ACTIVE" : "INACTIVE"}</span></td>
                      <td>
                        <div className="action-stack">
                          <form className="form-row compact-form" action={updateAssetAction}>
                            <input type="hidden" name="assetId" value={asset.id} />
                            <input type="hidden" name="returnTo" value="/admin/assets" />
                            <input name="name" defaultValue={asset.name} aria-label="ชื่อ" required />
                            <input name="model" defaultValue={asset.model ?? ""} aria-label="รุ่น" placeholder="รุ่น" />
                            <input name="assetNumber" defaultValue={asset.assetNumber ?? ""} aria-label="เลขครุภัณฑ์" placeholder="เลขครุภัณฑ์" />
                            <button className="button secondary" type="submit">บันทึก</button>
                          </form>
                          <form action={toggleAssetAction}>
                            <input type="hidden" name="assetId" value={asset.id} />
                            <input type="hidden" name="active" value={asset.active ? "false" : "true"} />
                            <button className={`button ${asset.active ? "danger" : "secondary"}`} type="submit">
                              {asset.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
