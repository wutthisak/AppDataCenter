import { notFound } from "next/navigation";
import type { Asset } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { DeleteAssetButton } from "@/components/DeleteAssetButton";
import { addAssetAction, toggleAssetAction, updateAssetAction } from "@/app/actions";
import { assetAccountLabels } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { assetCategoryRoutes, displayValue, equipmentAge, fieldsByCategory, fieldValue, parseAssetQuantity, type AssetField } from "@/lib/assets";

const pageSizeOptions = [10, 20, 30, 40, 50] as const;
type PageSize = typeof pageSizeOptions[number] | "all";

function matchesSearch(asset: Asset, fields: AssetField[], query: string) {
  if (!query) return true;
  const haystack = [
    asset.name,
    ...fields.map((field) => String(asset[field.name] ?? ""))
  ].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function parsePageSize(value?: string): PageSize {
  if (value === "all") return "all";
  const size = Number(value);
  return pageSizeOptions.includes(size as typeof pageSizeOptions[number]) ? size as PageSize : 10;
}

function parsePage(value?: string) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function assetPageHref(basePath: string, query: string, pageSize: PageSize, page: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("pageSize", String(pageSize));
  params.set("page", String(page));
  return `${basePath}?${params.toString()}`;
}

function getQuantityInputValues(asset: Asset | null, field: AssetField) {
  if (!field.unitOptions?.length) return { amount: "", unit: "" };
  const rawValue = asset ? fieldValue(asset, field) : "";
  return parseAssetQuantity(rawValue, field.unitOptions[0].value);
}

function renderAssetField(field: AssetField, asset?: Asset, fieldOptions: string[] = []) {
  if (field.unitOptions?.length) {
    const { amount, unit } = getQuantityInputValues(asset ?? null, field);
    return (
      <div className="asset-field-with-unit">
        <input
          name={`${field.name}Value`}
          type="number"
          step="0.01"
          defaultValue={amount}
          placeholder={field.placeholder}
          required={field.required}
          aria-label={field.label}
        />
        <select name={`${field.name}Unit`} defaultValue={unit || field.unitOptions[0].value} aria-label={`${field.label} หน่วย`}>
          {field.unitOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "select") {
    const defaultValue = asset ? fieldValue(asset, field) : "";
    const options = field.options?.length ? field.options : fieldOptions;
    return (
      <select name={field.name} defaultValue={defaultValue} aria-label={field.label} required={field.required}>
        <option value="" disabled>{field.placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      name={field.name}
      type={field.type ?? "text"}
      defaultValue={asset ? fieldValue(asset, field) : undefined}
      placeholder={field.placeholder}
      required={field.required}
      aria-label={field.label}
    />
  );
}

export default async function AssetCategoryAdminPage(
  props: {
    params: Promise<{ category: string }>;
    searchParams: Promise<{ q?: string; page?: string; pageSize?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  await requireUser(["ADMIN"]);
  const code = assetCategoryRoutes[params.category];
  if (!code) notFound();

  const category = await prisma.assetCategory.findUnique({
    where: { code },
    include: { assets: { orderBy: { name: "asc" } } }
  });
  if (!category) notFound();

  const fields = fieldsByCategory[category.code];
  const basePath = `/admin/assets/${params.category}`;
  const [databaseTypeOptions, osTypeOptions, networkBrandOptions, buildingOptions] = await Promise.all([
    prisma.assetOption.findMany({ where: { type: "DATABASE_TYPE" }, orderBy: { displayOrder: "asc" } }),
    prisma.assetOption.findMany({ where: { type: "OS_TYPE" }, orderBy: { displayOrder: "asc" } }),
    prisma.assetOption.findMany({ where: { type: "NETWORK_BRAND" }, orderBy: { displayOrder: "asc" } }),
    prisma.assetOption.findMany({ where: { type: "BUILDING" }, orderBy: { displayOrder: "asc" } })
  ]);
  const dynamicOptions: Record<string, string[]> = {
    databaseType: databaseTypeOptions.map((item) => item.value),
    os: osTypeOptions.map((item) => item.value),
    networkBrand: networkBrandOptions.map((item) => item.value),
    building: buildingOptions.map((item) => item.value)
  };
  const pageTone = category.code === "VM" ? "tone-vm" : category.code === "SERVER" ? "tone-host" : "tone-network";
  const query = String(searchParams.q ?? "").trim();
  const pageSize = parsePageSize(searchParams.pageSize);
  const visibleAssets = category.assets.filter((asset) => matchesSearch(asset, fields, query));
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(visibleAssets.length / pageSize));
  const currentPage = Math.min(parsePage(searchParams.page), totalPages);
  const pageStart = pageSize === "all" ? 0 : (currentPage - 1) * pageSize;
  const pagedAssets = pageSize === "all" ? visibleAssets : visibleAssets.slice(pageStart, pageStart + pageSize);
  const returnTo = assetPageHref(basePath, query, pageSize, currentPage);
  const showAge = category.code === "SERVER" || category.code === "NETWORK";

  return (
    <AppShell title={assetAccountLabels[category.code]} subtitle="เพิ่ม แก้ไข และดูแลบัญชีทรัพย์สินของศูนย์ข้อมูล">
      <div className={`asset-admin-page ${pageTone}`}>
        <section className="card asset-entry-card">
          <div className="section-heading">
            <div>
              <h2>เพิ่มรายการใหม่</h2>
              <p className="muted">กรอกชื่อก่อน แล้วเปิดรายละเอียดเฉพาะที่ต้องใช้</p>
            </div>
            <span className="badge">{category.assets.length} รายการ</span>
          </div>
          <form className="asset-form" action={addAssetAction}>
            <input type="hidden" name="categoryId" value={category.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <label>
              ชื่อ
              <input name="name" placeholder="ชื่อรายการ" required />
            </label>
            {fields.length > 0 ? (
              <details className="asset-details-fields">
                <summary>รายละเอียดเพิ่มเติมของทรัพย์สิน</summary>
                <div className="asset-detail-grid">
                  {fields.map((field) => (
                    <label key={field.name}>
                      {field.label}
                      {renderAssetField(field, undefined, dynamicOptions[field.source ?? field.name] ?? [])}
                    </label>
                  ))}
                </div>
              </details>
            ) : null}
            <div className="form-actions">
              <button className="button" type="submit">เพิ่มรายการ</button>
            </div>
          </form>
        </section>

        <section className="card asset-list-card">
          <div className="section-heading asset-list-heading">
            <div>
              <h2>รายการทั้งหมด</h2>
              <p className="muted">{category.assets.filter((asset) => asset.active).length} active / {category.assets.length} total · แสดง {pagedAssets.length} จาก {visibleAssets.length} รายการ</p>
            </div>
            <div className="asset-list-tools">
              <form className="asset-search" action={basePath}>
                <input type="hidden" name="page" value="1" />
                <input type="hidden" name="pageSize" value={pageSize} />
                <input name="q" defaultValue={query} placeholder="ค้นหาชื่อ, IP, รุ่น, เลขครุภัณฑ์" />
                <button className="button secondary" type="submit">ค้นหา</button>
              </form>
              <form className="asset-page-size-form" action={basePath}>
                <input type="hidden" name="page" value="1" />
                {query ? <input type="hidden" name="q" value={query} /> : null}
                <label className="asset-page-size-label" aria-label="จำนวนรายการต่อหน้า">
                  <select name="pageSize" defaultValue={pageSize}>
                    {pageSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
                    <option value="all">ทั้งหมด</option>
                  </select>
                </label>
                <button className="button secondary" type="submit">ตกลง</button>
              </form>
              <a className="button secondary" href={`/admin/assets/print?category=${category.code}&status=active`} target="_blank">พิมพ์รายงาน</a>
            </div>
          </div>

          <div className="asset-card-list">
            {visibleAssets.length === 0 ? (
              <div className="empty-state">ไม่พบรายการที่ค้นหา</div>
            ) : pagedAssets.map((asset, index) => (
              <article className="asset-item" key={asset.id}>
                <div className="asset-item-main">
                  <div className="asset-rank">#{pageStart + index + 1}</div>
                  <div className="asset-summary">
                    <div className="asset-title-row">
                      <h3>{asset.name}</h3>
                      <span className={`badge ${asset.active ? "" : "locked"}`}>{asset.active ? "ACTIVE" : "INACTIVE"}</span>
                    </div>
                    <div className="asset-chip-list">
                      {fields.map((field) => (
                        <span className="asset-chip" key={field.name}><b>{field.label}</b>{displayValue(asset, field)}</span>
                      ))}
                      {showAge ? <span className="asset-chip age-chip"><b>อายุอุปกรณ์</b>{equipmentAge(asset.installedAt)}</span> : null}
                    </div>
                  </div>
                </div>

                <div className="asset-edit-panel">
                  <form className="asset-edit-form" action={updateAssetAction}>
                    <input type="hidden" name="assetId" value={asset.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <input name="name" defaultValue={asset.name} aria-label="ชื่อ" required />
                    {fields.length > 0 ? (
                      <details className="asset-edit-details">
                        <summary>แก้ไขรายละเอียด</summary>
                        <div className="asset-detail-grid">
                          {fields.map((field) => (
                            <label key={field.name}>
                              {field.label}
                              {renderAssetField(field, asset, dynamicOptions[field.source ?? field.name] ?? [])}
                            </label>
                          ))}
                        </div>
                      </details>
                    ) : null}
                    <button className="button secondary" type="submit">บันทึก</button>
                  </form>
                  <div className="asset-row-actions">
                    <form action={toggleAssetAction}>
                      <input type="hidden" name="assetId" value={asset.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <input type="hidden" name="active" value={asset.active ? "false" : "true"} />
                      <button className={`button ${asset.active ? "danger" : "secondary"}`} type="submit">
                        {asset.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                      </button>
                    </form>
                    <DeleteAssetButton assetId={asset.id} assetName={asset.name} returnTo={returnTo} />
                  </div>
                </div>
              </article>
            ))}
          </div>

          {visibleAssets.length > 0 ? (
            <nav className="asset-pagination" aria-label="Asset pagination">
              <a
                className={`button secondary ${currentPage <= 1 ? "is-disabled" : ""}`}
                href={assetPageHref(basePath, query, pageSize, Math.max(1, currentPage - 1))}
                aria-disabled={currentPage <= 1}
              >
                ก่อนหน้า
              </a>
              <span className="asset-page-status">หน้า {currentPage} / {totalPages}</span>
              <a
                className={`button secondary ${currentPage >= totalPages ? "is-disabled" : ""}`}
                href={assetPageHref(basePath, query, pageSize, Math.min(totalPages, currentPage + 1))}
                aria-disabled={currentPage >= totalPages}
              >
                ถัดไป
              </a>
            </nav>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
