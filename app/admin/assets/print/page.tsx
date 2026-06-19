import Link from "next/link";
import type { Asset, AssetCategoryCode } from "@prisma/client";
import { assetAccountLabels } from "@/lib/constants";
import { displayValue, equipmentAge, fieldsByCategory } from "@/lib/assets";
import { PrintButton } from "@/components/PrintButton";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const categoryOptions: Array<AssetCategoryCode | "ALL"> = ["ALL", "VM", "SERVER", "NETWORK", "BACKUP"];
const statusOptions = ["active", "inactive", "all"] as const;
type StatusFilter = (typeof statusOptions)[number];

type CategoryWithAssets = Awaited<ReturnType<typeof getCategories>>[number];

function normalizeCategory(value?: string): AssetCategoryCode | "ALL" {
  return categoryOptions.includes(value as AssetCategoryCode | "ALL") ? value as AssetCategoryCode | "ALL" : "ALL";
}

function normalizeStatus(value?: string): StatusFilter {
  return statusOptions.includes(value as StatusFilter) ? value as StatusFilter : "active";
}

function statusWhere(status: StatusFilter) {
  if (status === "all") return {};
  return { active: status === "active" };
}

async function getCategories(category: AssetCategoryCode | "ALL", status: StatusFilter) {
  return prisma.assetCategory.findMany({
    where: category === "ALL" ? undefined : { code: category },
    orderBy: { displayOrder: "asc" },
    include: {
      assets: {
        where: statusWhere(status),
        orderBy: { displayOrder: "asc" }
      }
    }
  });
}

function printValue(asset: Asset, fieldName: string) {
  const value = asset[fieldName as keyof Asset];
  if (value instanceof Date) return value.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
  return typeof value === "string" && value ? value : "-";
}

function AssetPrintSection({ category }: { category: CategoryWithAssets }) {
  const fields = fieldsByCategory[category.code];
  const hasDetails = fields.length > 0;

  return (
    <section className="print-page asset-print-page">
      <h2>รายงานบัญชีทรัพย์สิน {assetAccountLabels[category.code]}</h2>
      <div className="print-period">จำนวน {category.assets.length} รายการ</div>
      <table className="print-table asset-print-table">
        <thead>
          <tr>
            <th className="print-no">ลำดับ</th>
            <th className="print-name">ชื่อรายการ</th>
            {hasDetails ? fields.map((field) => <th key={field.name}>{field.label}</th>) : <th>รายละเอียด</th>}
            <th>อายุอุปกรณ์</th>
            <th>สถานะ</th>
            <th>อัปเดตล่าสุด</th>
          </tr>
        </thead>
        <tbody>
          {category.assets.length === 0 ? (
            <tr><td colSpan={hasDetails ? fields.length + 5 : 6}>ไม่มีข้อมูล</td></tr>
          ) : category.assets.map((asset) => (
            <tr key={asset.id}>
              <td className="print-no">{asset.displayOrder}</td>
              <td className="print-name">{asset.name}</td>
              {hasDetails ? fields.map((field) => <td key={field.name}>{displayValue(asset, field)}</td>) : <td>{printValue(asset, "model")}</td>}
              <td>{equipmentAge(asset.installedAt)}</td>
              <td>{asset.active ? "ACTIVE" : "INACTIVE"}</td>
              <td>{asset.updatedAt.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="print-signatures">
        <span>ผู้จัดทำ..................................................</span>
        <span>ผู้ปฏิบัติงาน..................................................</span>
      </div>
    </section>
  );
}

export default async function AssetPrintPage(props: { searchParams: Promise<{ category?: string; status?: string }> }) {
  const searchParams = await props.searchParams;
  await requireUser(["ADMIN"]);
  const category = normalizeCategory(searchParams.category);
  const status = normalizeStatus(searchParams.status);
  const categories = await getCategories(category, status);

  return (
    <main className="print-preview-page">
      <div className="preview-toolbar no-print">
        <div>
          <div className="eyebrow">Asset Account Preview</div>
          <h1>พิมพ์รายงานบัญชีทรัพย์สิน</h1>
          <p className="muted">เลือกหมวดและสถานะ แล้วพิมพ์หรือบันทึกเป็น PDF</p>
        </div>
        <div className="preview-actions">
          <Link className="button secondary" href="/">กลับสู่ Dashboard</Link>
          <form className="asset-print-filter compact" action="/admin/assets/print">
            <label>
              หมวด
              <select name="category" defaultValue={category}>
                <option value="ALL">ทั้งหมด</option>
                <option value="VM">VM Host</option>
                <option value="SERVER">Host Server</option>
                <option value="NETWORK">Network Device</option>
                <option value="BACKUP">Database</option>
              </select>
            </label>
            <label>
              สถานะ
              <select name="status" defaultValue={status}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="all">ทั้งหมด</option>
              </select>
            </label>
            <button className="button secondary" type="submit">แสดงรายงาน</button>
          </form>
          <PrintButton />
        </div>
      </div>

      <div className="print-document">
        {categories.map((item) => <AssetPrintSection key={item.id} category={item} />)}
      </div>
    </main>
  );
}
