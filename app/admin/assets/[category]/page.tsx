import { notFound } from "next/navigation";
import type { Asset } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { DeleteAssetButton } from "@/components/DeleteAssetButton";
import { addAssetAction, toggleAssetAction, updateAssetAction } from "@/app/actions";
import { SaveWithToast } from "@/components/EditAssetForm";
import { assetAccountLabels } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { assetCategoryRoutes, displayValue, equipmentAge, equipmentAgeRisk, fieldsByCategory, fieldValue, isGeneratedBackupJobAssetCode, parseAssetQuantity, type AssetField } from "@/lib/assets";
import { AddAssetModal } from "@/components/AddAssetModal";

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
      <select name={field.name} defaultValue={defaultValue} aria-label={field.label}>
        <option value="">{field.placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    );
  }

  if (field.type === "date") {
    return (
      <input
        name={field.name}
        type="text"
        inputMode="numeric"
        defaultValue={asset ? fieldValue(asset, field) : undefined}
        placeholder="วว/ดด/ปปปป"
        aria-label={field.label}
      />
    );
  }

  return (
    <input
      name={field.name}
      type={field.type === "number" ? "number" : "text"}
      defaultValue={asset ? fieldValue(asset, field) : undefined}
      placeholder={field.placeholder}
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
  const [databaseTypeOptions, osTypeOptions, networkBrandOptions, deviceTypeOptions, storageDeviceTypeOptions, buildingOptions, ownershipTypeOptions, dataCenterOptions] = await Promise.all([
    prisma.assetOption.findMany({ where: { type: "DATABASE_TYPE" }, orderBy: { displayOrder: "asc" } }),
    prisma.assetOption.findMany({ where: { type: "OS_TYPE" }, orderBy: { displayOrder: "asc" } }),
    prisma.assetOption.findMany({ where: { type: "NETWORK_BRAND" }, orderBy: { displayOrder: "asc" } }),
    prisma.assetOption.findMany({ where: { type: "DEVICE_TYPE" }, orderBy: { displayOrder: "asc" } }),
    prisma.assetOption.findMany({ where: { type: "STORAGE_DEVICE_TYPE" }, orderBy: { displayOrder: "asc" } }),
    prisma.assetOption.findMany({ where: { type: "BUILDING" }, orderBy: { displayOrder: "asc" } }),
    prisma.assetOption.findMany({ where: { type: "ASSET_OWNERSHIP_TYPE" }, orderBy: { displayOrder: "asc" } }),
    prisma.dataCenter.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" } })
  ]);
  const dynamicOptions: Record<string, string[]> = {
    databaseType: databaseTypeOptions.map((item) => item.value),
    os: osTypeOptions.map((item) => item.value),
    networkBrand: networkBrandOptions.map((item) => item.value),
    deviceType: deviceTypeOptions.map((item) => item.value),
    storageDeviceType: storageDeviceTypeOptions.map((item) => item.value),
    building: buildingOptions.map((item) => item.value),
    ownershipType: ownershipTypeOptions.map((item) => item.value),
    dataCenter: dataCenterOptions.map((item) => item.name)
  };
  const pageTone = category.code === "VM" ? "tone-vm" : category.code === "SERVER" ? "tone-host" : "tone-network";
  const query = String(searchParams.q ?? "").trim();
  const pageSize = parsePageSize(searchParams.pageSize);
  const categoryAssets = category.code === "BACKUP"
    ? category.assets.filter((asset) => !isGeneratedBackupJobAssetCode(asset.code))
    : category.assets;
  const visibleAssets = categoryAssets.filter((asset) => matchesSearch(asset, fields, query));
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(visibleAssets.length / pageSize));
  const currentPage = Math.min(parsePage(searchParams.page), totalPages);
  const pageStart = pageSize === "all" ? 0 : (currentPage - 1) * pageSize;
  const pagedAssets = pageSize === "all" ? visibleAssets : visibleAssets.slice(pageStart, pageStart + pageSize);
  const returnTo = assetPageHref(basePath, query, pageSize, currentPage);
  const showAge = category.code === "SERVER" || category.code === "NETWORK" || category.code === "STORAGE";

  return (
    <AppShell title={assetAccountLabels[category.code]} subtitle="เพิ่ม แก้ไข และดูแลบัญชีทรัพย์สินของศูนย์ข้อมูล">
      <div className={`asset-admin-page ${pageTone}`}>
        <section className="card asset-list-card">
          <div className="section-heading asset-list-heading">
            <div>
              <h2>รายการทั้งหมด</h2>
              <p className="muted">{categoryAssets.filter((asset) => asset.active).length} active / {categoryAssets.length} total · แสดง {pagedAssets.length} จาก {visibleAssets.length} รายการ</p>
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
              <AddAssetModal
                categoryId={category.id}
                returnTo={returnTo}
                steps={(() => {
                  const toModalField = (f: typeof fields[number]) =>
                    f.unitOptions?.length
                      ? { kind: "number-unit" as const, name: f.name, label: f.label, placeholder: f.placeholder, required: f.required, units: f.unitOptions }
                      : f.type === "select"
                        ? { kind: "select" as const, name: f.name, label: f.label, placeholder: f.placeholder, required: f.required, options: f.options?.length ? f.options : (dynamicOptions[f.source ?? f.name] ?? []) }
                        : { kind: "text" as const, name: f.name, label: f.label, placeholder: f.placeholder, required: f.required };
                  if (category.code === "SERVER") {
                    return [
                      { label: "Hardware", fields: fields.filter((f) => ["cpu","ram","disk"].includes(f.name)).map(toModalField) },
                      { label: "ระบบ / ทะเบียน", fields: fields.filter((f) => !["cpu","ram","disk"].includes(f.name)).map(toModalField) },
                    ];
                  }
                  if (category.code === "NETWORK") {
                    return [
                      { label: "อุปกรณ์", fields: fields.filter((f) => ["deviceType","ownershipType","model","brand"].includes(f.name)).map(toModalField) },
                      { label: "ที่ตั้ง / วันที่", fields: fields.filter((f) => ["location","building","floor","installedAt"].includes(f.name)).map(toModalField) },
                    ];
                  }
                  if (category.code === "STORAGE") {
                    return [
                      { label: "อุปกรณ์", fields: fields.filter((f) => ["deviceType","ownershipType","brand","model"].includes(f.name)).map(toModalField) },
                      { label: "ตำแหน่ง / ความจุ", fields: fields.filter((f) => ["location","disk","assetNumber","installedAt"].includes(f.name)).map(toModalField) },
                    ];
                  }
                  const detailFields = fields.filter((f) => f.name !== "ipAddress").map(toModalField);
                  return detailFields.length > 0 ? [{ label: "รายละเอียด", fields: detailFields }] : [];
                })()}
                ipPlaceholder="เช่น 192.168.1.10"
              />
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
                      <div className="asset-title-badges">
                        <span className="asset-type-badge">{assetAccountLabels[category.code]}</span>
                        <span className={`badge asset-status-badge ${asset.active ? "" : "locked"}`}>{asset.active ? "ACTIVE" : "INACTIVE"}</span>
                      </div>
                    </div>
                    <div className="asset-chip-list">
                      {asset.ipAddress ? <span className="asset-chip asset-chip--ip"><b>IP</b>{asset.ipAddress}</span> : null}
                      {fields.map((field) => (
                        <span className="asset-chip" key={field.name}><b>{field.label}</b>{displayValue(asset, field)}</span>
                      ))}
                      {showAge ? <span className={`asset-chip age-chip age-chip--${equipmentAgeRisk(asset.installedAt)}`}><b>อายุอุปกรณ์</b>{equipmentAge(asset.installedAt)}</span> : null}
                    </div>
                  </div>
                </div>

                <details className="asset-edit-panel">
                  <summary className="asset-edit-summary">แก้ไขรายละเอียด</summary>
                  <div className="asset-edit-panel-body">
                    <form className="asset-edit-form" id={`asset-update-${asset.id}`}>
                      <input type="hidden" name="assetId" value={asset.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <div className="asset-detail-grid">
                        <label>
                          ชื่อรายการ
                          <input name="name" defaultValue={asset.name} required placeholder="ชื่อรายการ" />
                        </label>
                        <label>
                          IP Address
                          <input name="ipAddress" defaultValue={asset.ipAddress ?? ""} placeholder="เช่น 192.168.1.10" />
                        </label>
                        {fields.filter((field) => field.name !== "ipAddress").map((field) => {
                          const fullWidth = ["deviceType", "databaseType"].includes(field.name) || (field.name === "os" && category.code !== "VM" && category.code !== "SERVER");
                          return (
                            <label key={field.name} className={fullWidth ? "asset-detail-grid__full" : ""}>
                              {field.label}
                              {renderAssetField(field, asset, dynamicOptions[field.source ?? field.name] ?? [])}
                            </label>
                          );
                        })}
                      </div>
                    </form>
                    <div className="asset-row-actions">
                      <SaveWithToast formId={`asset-update-${asset.id}`} />
                      <form action={toggleAssetAction}>
                        <input type="hidden" name="assetId" value={asset.id} />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <input type="hidden" name="active" value={asset.active ? "false" : "true"} />
                        <button className={`button asset-action-button ${asset.active ? "asset-action-button--warning" : "asset-action-button--restore"}`} type="submit">
                          {asset.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                        </button>
                      </form>
                      <DeleteAssetButton assetId={asset.id} assetName={asset.name} returnTo={returnTo} />
                    </div>
                  </div>
                </details>
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
