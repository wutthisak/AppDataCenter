import Link from "next/link";
import type { Asset, AssetCategoryCode } from "@prisma/client";
import { Activity, CalendarClock, Cpu, HardDrive, List, Monitor, Search, Server, Clock3, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Hash, AppWindow } from "lucide-react";
import { assetAccountLabels } from "@/lib/constants";
import { displayValue, equipmentAge, equipmentAgeMonths, fieldsByCategory, formatBuddhistDate, formatBuddhistLocalDate, isGeneratedBackupJobAssetCode, type AssetField } from "@/lib/assets";
import { PrintButton } from "@/components/PrintButton";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import styles from "./page.module.css";

const categoryOptions: Array<AssetCategoryCode | "ALL"> = ["ALL", "VM", "SERVER", "NETWORK", "STORAGE", "BACKUP"];
const statusOptions = ["active", "inactive", "all"] as const;
type StatusFilter = (typeof statusOptions)[number];
const searchByOptions = ["name", "age", "type", "building"] as const;
type SearchBy = (typeof searchByOptions)[number];
type ReportCoreKey = "no" | "name" | "age" | "updatedAt" | "ipAddress";
type ReportColumn = {
  key: ReportCoreKey | string;
  label: string;
  width: number;
  type: "core" | "field";
  coreKey?: ReportCoreKey;
  fieldName?: string;
};
const ASSET_PRINT_ROWS_PER_PAGE = 35;

function chunkPrintRows<T>(rows: T[], pageSize = ASSET_PRINT_ROWS_PER_PAGE): T[][] {
  if (rows.length === 0) return [[]];

  const pages: T[][] = [];
  for (let index = 0; index < rows.length; index += pageSize) {
    pages.push(rows.slice(index, index + pageSize));
  }
  return pages;
}

function coreColumnWidth(categoryCode: AssetCategoryCode, key: ReportCoreKey) {
  const network: Record<ReportCoreKey, number> = {
    no: 42,
    name: 128,
    age: 74,
    updatedAt: 92,
    ipAddress: 132
  };
  const common: Record<ReportCoreKey, number> = {
    no: 72,
    name: 200,
    age: 128,
    updatedAt: 150,
    ipAddress: 160
  };
  return (categoryCode === "NETWORK" ? network : common)[key];
}

type CategoryWithAssets = Awaited<ReturnType<typeof getCategories>>[number];
function buildListHref(categoryCode: AssetCategoryCode, status: StatusFilter, query: string, page: number, searchBy: SearchBy) {
  const params = new URLSearchParams();
  params.set("category", categoryCode);
  params.set("status", status);
  params.set("by", searchBy);
  if (query) params.set("q", query);
  params.set("page", String(page));

  return `/admin/assets/print?${params.toString()}`;
}

function normalizeCategory(value?: string): AssetCategoryCode | "ALL" {
  const aliasMap: Record<string, AssetCategoryCode> = {
    VM_HOST: "VM",
    HOST_SERVER: "SERVER",
    NETWORK_DEVICE: "NETWORK",
    STORAGE_DEVICE: "STORAGE"
  };
  const normalized = String(value ?? "").trim().toUpperCase();
  if (aliasMap[normalized]) return aliasMap[normalized];
  return categoryOptions.includes(normalized as AssetCategoryCode | "ALL") ? normalized as AssetCategoryCode | "ALL" : "ALL";
}

function normalizeStatus(value?: string): StatusFilter {
  return statusOptions.includes(value as StatusFilter) ? value as StatusFilter : "active";
}

function normalizeSearchBy(value?: string): SearchBy {
  return searchByOptions.includes(value as SearchBy) ? value as SearchBy : "name";
}

function statusLabel(status: StatusFilter) {
  if (status === "active") return "Active (ใช้งาน)";
  if (status === "inactive") return "Inactive (ไม่ใช้งาน)";
  return "Active / Inactive ทั้งหมด";
}

function statusWhere(status: StatusFilter) {
  if (status === "all") return {};
  return { active: status === "active" };
}

function parseAgeRange(query: string) {
  const match = query.trim().replace(/[–—]/g, "-").match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const from = Number.parseFloat(match[1]);
  const to = Number.parseFloat(match[2]);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;

  return {
    min: Math.min(from, to),
    max: Math.max(from, to)
  };
}

function matchesAgeQuery(installedAt: Date | null, query: string, term: string) {
  const range = parseAgeRange(query);
  if (range) {
    const months = equipmentAgeMonths(installedAt);
    if (months === null) return false;

    const years = Math.floor(months / 12);
    return years >= range.min && years <= range.max;
  }

  return equipmentAge(installedAt).toLowerCase().includes(term);
}

async function getCategories(category: AssetCategoryCode | "ALL", status: StatusFilter) {
  const categories = await prisma.assetCategory.findMany({
    where: category === "ALL" ? undefined : { code: category },
    orderBy: { displayOrder: "asc" },
    include: {
      assets: {
        where: statusWhere(status),
        orderBy: { displayOrder: "asc" }
      }
    }
  });
  return categories.map((item) => ({
    ...item,
    assets: item.code === "BACKUP"
      ? item.assets.filter((asset) => !isGeneratedBackupJobAssetCode(asset.code))
      : item.assets,
  }));
}

function printValue(asset: Asset, fieldName: string) {
  const value = asset[fieldName as keyof Asset];
  if (value instanceof Date) return formatBuddhistDate(value);
  return typeof value === "string" && value ? value : "-";
}

function hasFieldData(assets: Asset[], fieldName: string) {
  return assets.some((asset) => {
    const value = asset[fieldName as keyof Asset];
    if (value instanceof Date) return true;
    if (typeof value === "string") return value.trim().length > 0;
    return false;
  });
}

function fieldWidth(categoryCode: AssetCategoryCode, fieldName: string) {
  if (categoryCode === "NETWORK") {
    const networkMap: Record<string, number> = {
      deviceType: 96,
      ownershipType: 92,
      model: 104,
      brand: 82,
      ipAddress: 132,
      location: 102,
      building: 68,
      floor: 52,
      installedAt: 74
    };
    return networkMap[fieldName] ?? 88;
  }

  const widthMap: Record<string, number> = {
    ipAddress: 170,
    model: 150,
    brand: 130,
    databaseType: 170,
    deviceType: 160,
    ownershipType: 140,
    os: 160,
    assetNumber: 150,
    cpu: 110,
    ram: 120,
    disk: 120,
    location: 170,
    building: 130,
    floor: 90,
    installedAt: 120
  };
  return widthMap[fieldName] ?? 140;
}

function buildDynamicFieldColumns(categoryCode: AssetCategoryCode, fields: AssetField[], assets: Asset[], excludedFields = new Set<string>()) {
  const importantByCategory: Record<AssetCategoryCode, string[]> = {
    VM: ["cpu", "ram", "disk", "os"],
    SERVER: ["cpu", "ram", "disk", "os", "ownershipType", "assetNumber"],
    NETWORK: ["deviceType", "ownershipType", "model", "brand", "ipAddress", "building"],
    STORAGE: ["deviceType", "ownershipType", "brand", "model", "ipAddress", "location", "disk"],
    BACKUP: ["databaseType"]
  };
  const importantSet = new Set(importantByCategory[categoryCode]);

  return fields.filter((field: { name: string }) => {
    if (excludedFields.has(field.name)) return false;
    return importantSet.has(field.name) || hasFieldData(assets, field.name);
  });
}

function buildReportColumns(categoryCode: AssetCategoryCode, fields: AssetField[], assets: Asset[]): ReportColumn[] {
  const hasInstalledAtData = hasFieldData(assets, "installedAt");
  const showIpColumn = categoryCode === "BACKUP" || assets.some((a) => a.ipAddress);
  const dynamicFields = buildDynamicFieldColumns(categoryCode, fields, assets, showIpColumn ? new Set(["ipAddress"]) : undefined);
  const leadingCoreColumns: ReportColumn[] = [
    { key: "no", coreKey: "no", label: "ลำดับ", width: coreColumnWidth(categoryCode, "no"), type: "core" as const },
    { key: "name", coreKey: "name", label: "ชื่อรายการ", width: coreColumnWidth(categoryCode, "name"), type: "core" as const },
    ...(showIpColumn ? [{ key: "ipAddress", coreKey: "ipAddress" as ReportCoreKey, label: "IP Address", width: 160, type: "core" as const }] : [])
  ];
  const fieldColumns: ReportColumn[] = dynamicFields.map((field) => ({
      key: `field:${field.name}`,
      fieldName: field.name,
      label: field.label,
      width: fieldWidth(categoryCode, field.name),
      type: "field" as const
    }));
  const ageColumns: ReportColumn[] = hasInstalledAtData
    ? [{ key: "age", coreKey: "age", label: "อายุอุปกรณ์", width: coreColumnWidth(categoryCode, "age"), type: "core" as const }]
    : [];
  const trailingCoreColumns: ReportColumn[] = [
    { key: "updatedAt", coreKey: "updatedAt", label: "อัปเดตล่าสุด", width: coreColumnWidth(categoryCode, "updatedAt"), type: "core" as const }
  ];

  const columns: ReportColumn[] = [...leadingCoreColumns, ...fieldColumns, ...ageColumns, ...trailingCoreColumns];

  return columns;
}

function renderFieldHeaderIcon(fieldName: string) {
  const lower = fieldName.toLowerCase();
  if (lower.includes("cpu")) return <Cpu size={16} />;
  if (lower.includes("ram")) return <Server size={16} />;
  if (lower.includes("disk")) return <HardDrive size={16} />;
  if (lower.includes("os") || lower.includes("ip")) return <Monitor size={16} />;
  return null;
}

function renderColumnCell(asset: Asset, column: ReportColumn, rowNumber: number, fieldLookup: Record<string, AssetField | undefined>) {
  if (column.type === "field" && column.fieldName) {
    const field = fieldLookup[column.fieldName];
    if (!field) return "-";
    return displayValue(asset, field);
  }

  switch (column.coreKey) {
    case "no":
      return rowNumber;
    case "name":
      return asset.name;
    case "age":
      return equipmentAge(asset.installedAt);
    case "updatedAt":
      return formatBuddhistLocalDate(asset.updatedAt);
    case "ipAddress":
      return asset.ipAddress ?? "-";
    default:
      return "-";
  }
}



function AssetPrintSection({ category, query, page, status, searchBy, printedAt, isLastCategory }: { category: CategoryWithAssets; query: string; page: number; status: StatusFilter; searchBy: SearchBy; printedAt: Date; isLastCategory: boolean }) {
  const fields = fieldsByCategory[category.code];
  const fieldLookup = Object.fromEntries(fields.map((field) => [field.name, field])) as Record<string, AssetField | undefined>;
  const columns = buildReportColumns(category.code, fields, category.assets);
  const totalColumnWidth = Math.max(1, columns.reduce((sum, column) => sum + column.width, 0));
  const pageSize = 10;
  const filteredAssets = category.assets.filter((asset) => {
    if (!query) return true;
    const term = query.toLowerCase();
    if (searchBy === "name") {
      return asset.name.toLowerCase().includes(term);
    }
    if (searchBy === "age") {
      return matchesAgeQuery(asset.installedAt, query, term);
    }
    if (searchBy === "building") {
      return (asset.building ?? "").toLowerCase().includes(term);
    }

    const typeText = `${printValue(asset, "deviceType")} ${printValue(asset, "ownershipType")} ${printValue(asset, "databaseType")} ${printValue(asset, "os")}`.toLowerCase();
    return typeText.includes(term);
  });

  const totalFiltered = filteredAssets.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pagedAssets = filteredAssets.slice(startIndex, startIndex + pageSize);

  const categoryNames: Record<string, string> = {
    VM: "VM Host (เครื่องเสมือน)",
    SERVER: "Host Server (เครื่องแม่ข่าย)",
    NETWORK: "Network Device (อุปกรณ์เครือข่าย)",
    STORAGE: "Storage Device (อุปกรณ์จัดเก็บข้อมูล)",
    BACKUP: "Database / Backup"
  };
  const categoryName = categoryNames[category.code] || assetAccountLabels[category.code];
  const statusText = statusLabel(status);
  const printedAtText = formatBuddhistLocalDate(printedAt);
  const activeCount = filteredAssets.filter((asset) => asset.active).length;
  const inactiveCount = filteredAssets.length - activeCount;
  const printPages = chunkPrintRows(filteredAssets);

  return (
    <section className={`print-page asset-print-page ${styles.reportSection}`}>
      <div className={styles.screenOnly}>
        <div className={styles.modernHeader}>
          <div className={styles.modernHeaderIdentity}>
            <div className={styles.modernIconBubble}>
              <Monitor size={30} />
            </div>
            <div>
              <h2 className={styles.modernTitle}>{categoryName}</h2>
              <p className={styles.modernSubTitle}>รายการและสถานะของ{categoryName}ทั้งหมด</p>
              <div className={styles.reportMetaRow}>
                <span className={styles.reportMetaItem}><List size={14} /> หมวด: {categoryName}</span>
                <span className={styles.reportMetaItem}><Activity size={14} /> สถานะ: {statusText}</span>
                <span className={styles.reportMetaItem}><Clock3 size={14} /> วันที่พิมพ์: {printedAtText}</span>
              </div>
            </div>
          </div>

          <div className={styles.modernCountBadge}>
            <List size={16} />
            {category.assets.length} รายการ
          </div>
        </div>

        <div className={styles.modernToolbar}>
          <form className={styles.searchForm} action="/admin/assets/print">
            <input type="hidden" name="category" value={category.code} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="page" value="1" />
            <select name="by" defaultValue={searchBy} className={styles.searchTypeSelect}>
              <option value="name">ชื่อ</option>
              <option value="age">อายุ</option>
              <option value="type">ประเภท</option>
              <option value="building">อาคาร</option>
            </select>
            <div className={styles.searchField}>
              <Search size={18} />
              <input
                name="q"
                defaultValue={query}
                placeholder={searchBy === "age" ? "ค้นหาอายุ เช่น 1-5, 5-10..." : searchBy === "type" ? "ค้นหาประเภทอุปกรณ์..." : searchBy === "building" ? "ค้นหาอาคาร..." : `ค้นหาชื่อ${categoryNames[category.code] || assetAccountLabels[category.code]}...`}
              />
            </div>
            <button className={styles.searchSubmitButton} type="submit">
              ค้นหา
            </button>
          </form>
        </div>

        <div className={styles.tableWrapper}>
          <table className={`print-table asset-print-table ${styles.dataTable} ${styles.modernDataTable} ${styles.dynamicReportTable}`} style={{ minWidth: `${Math.max(980, totalColumnWidth)}px` }}>
            <colgroup>
              {columns.map((column) => (
                <col key={`screen-col-${column.key}`} style={{ width: `${column.width}px` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {columns.map((column) => {
                  if (column.coreKey === "no") return <th className={styles.colNo} key={column.key}><Hash size={14} /> {column.label}</th>;
                  if (column.coreKey === "name") return <th className={styles.colName} key={column.key}><AppWindow size={14} /> {column.label}</th>;
                  if (column.coreKey === "age") return <th key={column.key}><CalendarClock size={16} /> {column.label}</th>;
                  if (column.coreKey === "updatedAt") return <th key={column.key}><Clock3 size={16} /> {column.label}</th>;
                  return (
                    <th key={column.key}>
                      {renderFieldHeaderIcon(column.fieldName ?? "")}
                      {column.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pagedAssets.length === 0 ? (
                <tr className={styles.emptyRow}>
                  <td colSpan={columns.length}>ไม่มีข้อมูล</td>
                </tr>
              ) : pagedAssets.map((asset, idx) => (
                <tr key={asset.id} data-status={asset.active ? "active" : "inactive"}>
                  {columns.map((column) => {
                    const value = renderColumnCell(asset, column, startIndex + idx + 1, fieldLookup);
                    if (column.coreKey === "no") return <td className={styles.colNo} key={`${asset.id}-${column.key}`}>{value}</td>;
                    if (column.coreKey === "name") return <td className={styles.colName} key={`${asset.id}-${column.key}`}><strong>{String(value)}</strong></td>;
                    if (column.coreKey === "updatedAt") return <td className={styles.textMuted} key={`${asset.id}-${column.key}`}>{String(value)}</td>;
                    return <td key={`${asset.id}-${column.key}`}>{String(value)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.modernPagerBar}>
          <span className={styles.modernPagerCopy}>แสดง {totalFiltered === 0 ? 0 : startIndex + 1} ถึง {Math.min(startIndex + pageSize, totalFiltered)} จาก {totalFiltered} รายการ</span>
          <div className={styles.modernPagerControls}>
            <Link className={styles.pagerBtn} href={buildListHref(category.code, status, query, 1, searchBy)} aria-label="first"><ChevronsLeft size={15} /></Link>
            <Link className={styles.pagerBtn} href={buildListHref(category.code, status, query, Math.max(1, currentPage - 1), searchBy)} aria-label="previous"><ChevronLeft size={15} /></Link>
            {Array.from({ length: totalPages }).slice(0, 6).map((_, i) => {
              const pageNumber = i + 1;
              const activeClass = pageNumber === currentPage ? `${styles.pagerBtn} ${styles.pagerBtnActive}` : styles.pagerBtn;
              return <Link key={pageNumber} className={activeClass} href={buildListHref(category.code, status, query, pageNumber, searchBy)}>{pageNumber}</Link>;
            })}
            <Link className={styles.pagerBtn} href={buildListHref(category.code, status, query, Math.min(totalPages, currentPage + 1), searchBy)} aria-label="next"><ChevronRight size={15} /></Link>
            <Link className={styles.pagerBtn} href={buildListHref(category.code, status, query, totalPages, searchBy)} aria-label="last"><ChevronsRight size={15} /></Link>
          </div>
        </div>
      </div>

      <div className={styles.printOnly}>
        {printPages.map((assets, printPageIndex) => {
          const pageOffset = printPageIndex * ASSET_PRINT_ROWS_PER_PAGE;
          const isFinalPrintPage = isLastCategory && printPageIndex === printPages.length - 1;

          return (
            <section className={styles.printPageSheet} key={`${category.id}:print:${printPageIndex}`}>
              <header className={styles.printReportHeader}>
                <div className={styles.printPageCount}>หน้า {printPageIndex + 1}/{printPages.length}</div>
                <h3 className={styles.printMainTitle}>รายงานบัญชีทรัพย์สิน {categoryName}</h3>
                <div className={styles.printSubTitle}>วันที่ออกรายงาน {printedAtText}</div>
                <div className={styles.printLegend}>
                  <span className={styles.printLegendItem}><strong>รวม</strong><span>{totalFiltered} รายการ</span></span>
                  <span className={styles.printLegendItem}><strong>A</strong><span>ใช้งาน {activeCount}</span></span>
                  <span className={styles.printLegendItem}><strong>I</strong><span>ไม่ใช้งาน {inactiveCount}</span></span>
                  <span className={styles.printLegendItem}><strong>สถานะ</strong><span>{statusText}</span></span>
                </div>
              </header>

              <table className={`print-table asset-print-table ${styles.printDataTable} ${styles.dynamicPrintTable}`}>
                <colgroup>
                  {columns.map((column) => (
                    <col key={`print-col-${column.key}`} style={{ width: `${((column.width / totalColumnWidth) * 100).toFixed(3)}%` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr className={styles.printColumnHeaderRow}>
                    {columns.map((column) => {
                      if (column.coreKey === "no") return <th className={styles.colNo} key={`print-head-${column.key}`}>{column.label}</th>;
                      if (column.coreKey === "name") return <th className={styles.colName} key={`print-head-${column.key}`}>{column.label}</th>;
                      return <th key={`print-head-${column.key}`}>{column.label}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {assets.length === 0 ? (
                    <tr className={styles.emptyRow}>
                      <td colSpan={columns.length}>ไม่มีข้อมูล</td>
                    </tr>
                  ) : assets.map((asset, idx) => (
                    <tr key={asset.id}>
                      {columns.map((column) => {
                        const value = renderColumnCell(asset, column, pageOffset + idx + 1, fieldLookup);
                        if (column.coreKey === "no") return <td className={styles.colNo} key={`${asset.id}-print-${column.key}`}>{value}</td>;
                        if (column.coreKey === "name") return <td className={styles.colName} key={`${asset.id}-print-${column.key}`}>{String(value)}</td>;
                        return <td key={`${asset.id}-print-${column.key}`}>{String(value)}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {isFinalPrintPage ? (
                <div className={styles.printSummaryBlock}>
                  <span>วันที่พิมพ์รายงาน: <strong>{printedAtText}</strong></span>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </section>
  );
}

export default async function AssetPrintPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  await requireUser(["ADMIN"]);
  const category = normalizeCategory(searchParams.category);
  const status = normalizeStatus(searchParams.status);
  const searchBy = normalizeSearchBy(searchParams.by);
  const query = (searchParams.q ?? "").trim();
  const page = Number.parseInt(searchParams.page ?? "1", 10);
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const categories = await getCategories(category, status);
  const printedAt = new Date();
  const totalAssets = categories.reduce((sum, item) => sum + item.assets.length, 0);

  return (
    <main className={`print-preview-page ${styles.container}`}>
      {/* Header Section */}
      <header className={`no-print ${styles.header}`}>
        <div className={styles.headerContent}>
          <div className={styles.headerTitle}>
            <span className={styles.headerBadge}>รายงานระบบ</span>
            <h1>รายงานบัญชีทรัพย์สิน</h1>
            <p>แสดงรายการทรัพย์สินสำหรับตรวจสอบและพิมพ์เอกสารอย่างเป็นทางการ</p>
          </div>
          <Link className={styles.backButton} href="/" title="Back to Dashboard">
            <span>←</span> กลับสู่แดชบอร์ด
          </Link>
        </div>
      </header>

      {/* Control Panel */}
      <div className={`no-print ${styles.controlPanel}`}>
        <form className={styles.filterForm} action="/admin/assets/print">
          <input type="hidden" name="page" value="1" />
          <div className={styles.formGroup}>
            <label htmlFor="category">หมวด</label>
            <select id="category" name="category" defaultValue={category}>
              <option value="ALL">ทั้งหมด</option>
              <option value="VM">เครื่องเสมือน</option>
              <option value="SERVER">เครื่องแม่ข่าย</option>
              <option value="NETWORK">อุปกรณ์เครือข่าย</option>
              <option value="BACKUP">ระบบฐานข้อมูล</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="status">สถานะ</label>
            <select id="status" name="status" defaultValue={status}>
              <option value="active">ใช้งาน</option>
              <option value="inactive">ปิดใช้งาน</option>
              <option value="all">ทั้งหมด</option>
            </select>
          </div>

          <button className={styles.submitButton} type="submit">
            <span>⟳</span> แสดงรายงาน
          </button>
        </form>

        <div className={styles.stats}>
          <div className={`${styles.statCard} ${styles.statCardTotal}`}>
            <div className={styles.statLabel}>ทรัพย์สินทั้งหมด</div>
            <div className={styles.statValue}>{totalAssets}</div>
          </div>
          <div className={`${styles.statCard} ${styles.statCardActive}`}>
            <div className={styles.statLabel}>จำนวนหมวด</div>
            <div className={styles.statValue}>{categories.length}</div>
          </div>
          <div className={`${styles.statCard} ${styles.statCardFormat}`}>
            <div className={styles.statLabel}>รูปแบบ</div>
            <div className={styles.statValue}>A4 แนวนอน</div>
          </div>
        </div>

        <div className={styles.actions}>
          <PrintButton label="Print / Save as PDF" />
        </div>
      </div>

      {/* Document Section */}
      <div className={styles.documents}>
        {categories.map((item, index) => (
          <AssetPrintSection
            key={item.id}
            category={item}
            query={query}
            page={safePage}
            status={status}
            searchBy={searchBy}
            printedAt={printedAt}
            isLastCategory={index === categories.length - 1}
          />
        ))}
      </div>
      <div className={styles.printFixedFooter} aria-hidden="true" />
    </main>
  );
}
