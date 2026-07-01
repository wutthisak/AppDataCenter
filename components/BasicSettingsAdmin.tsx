"use client";

import type { AssetOption, AssetOptionType } from "@prisma/client";
import type { FormEvent } from "react";
import { useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CheckCircle2,
  CircleSlash,
  Database,
  HardDrive,
  Layers3,
  Network,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X
} from "lucide-react";
import { addAssetOptionAction, deleteAssetOptionAction, updateAssetOptionAction } from "@/app/actions";

type OptionGroup = {
  type: AssetOptionType;
  tabId: string;
  title: string;
  description: string;
  placeholder: string;
  accent: "blue" | "green" | "violet" | "teal" | "amber";
  Icon: LucideIcon;
};

type PendingSubmit = {
  form: HTMLFormElement;
  title: string;
  message: string;
  tone: "success" | "danger";
} | null;

const optionGroups: OptionGroup[] = [
  {
    type: "DATABASE_TYPE",
    tabId: "database",
    title: "Type Database",
    description: "ประเภทฐานข้อมูลสำหรับบัญชีทรัพย์สิน Database",
    placeholder: "เพิ่ม เช่น MySQL, SQL Server",
    accent: "blue",
    Icon: Database
  },
  {
    type: "OS_TYPE",
    tabId: "os",
    title: "Type OS",
    description: "ระบบปฏิบัติการสำหรับ VM Host และ Host Server",
    placeholder: "เพิ่ม เช่น Windows, Ubuntu, Rocky",
    accent: "green",
    Icon: HardDrive
  },
  {
    type: "NETWORK_BRAND",
    tabId: "network",
    title: "ยี่ห้ออุปกรณ์",
    description: "ยี่ห้ออุปกรณ์เครือข่าย Switch / Firewall",
    placeholder: "เพิ่ม เช่น Cisco, Huawei, HPE",
    accent: "violet",
    Icon: Network
  },
  {
    type: "DEVICE_TYPE",
    tabId: "device-type",
    title: "ประเภทอุปกรณ์",
    description: "ประเภทอุปกรณ์เครือข่าย เช่น Switch / Access point / Router / Firewall",
    placeholder: "เพิ่ม เช่น Switch, Access point, Router, Firewall",
    accent: "teal",
    Icon: Layers3
  },
  {
    type: "STORAGE_DEVICE_TYPE",
    tabId: "storage-device-type",
    title: "Type Storage",
    description: "ประเภทอุปกรณ์จัดเก็บข้อมูลสำหรับบัญชีทรัพย์สิน Storage Device",
    placeholder: "เพิ่ม เช่น SAN, NAS, External USB",
    accent: "violet",
    Icon: HardDrive
  },
  {
    type: "BUILDING",
    tabId: "building",
    title: "อาคาร",
    description: "ชื่ออาคารสำหรับระบุตำแหน่งติดตั้งอุปกรณ์",
    placeholder: "เพิ่ม เช่น อาคาร A, อาคาร B",
    accent: "amber",
    Icon: Building2
  },
  {
    type: "ASSET_OWNERSHIP_TYPE",
    tabId: "ownership",
    title: "ประเภททรัพย์สิน",
    description: "เช่า/ซื้อสำหรับ Host Server และ Network Device",
    placeholder: "เพิ่ม เช่น เช่า, ซื้อ",
    accent: "blue",
    Icon: Settings2
  }
];

const errorMessages: Record<string, string> = {
  invalid: "กรุณากรอกข้อมูลให้ครบถ้วน",
  duplicate: "มีค่านี้อยู่แล้วในประเภทเดียวกัน",
  "not-found": "ไม่พบรายการที่ต้องการแก้ไข"
};

export function BasicSettingsAdmin({
  options,
  activeTab,
  error,
  saved
}: {
  options: AssetOption[];
  activeTab: string;
  error?: string;
  saved?: string;
}) {
  const [pendingSubmit, setPendingSubmit] = useState<PendingSubmit>(null);
  const confirmedFormRef = useRef<HTMLFormElement | null>(null);

  const optionsByType = useMemo(() => {
    return options.reduce<Record<AssetOptionType, AssetOption[]>>((acc, option) => {
      acc[option.type].push(option);
      return acc;
    }, {
      DATABASE_TYPE: [],
      OS_TYPE: [],
      NETWORK_BRAND: [],
      DEVICE_TYPE: [],
      STORAGE_DEVICE_TYPE: [],
      BUILDING: [],
      ASSET_OWNERSHIP_TYPE: []
    });
  }, [options]);

  const totalOptions = options.length;
  const activeGroup = optionGroups.find((group) => group.tabId === activeTab);
  const notice = error ? { type: "error" as const, message: errorMessages[error] ?? "เกิดข้อผิดพลาดในการบันทึกข้อมูล" } :
    saved === "1" ? { type: "success" as const, message: "บันทึกข้อมูลเรียบร้อยแล้ว" } : null;

  function interceptSubmit(event: FormEvent<HTMLFormElement>, pending: Omit<NonNullable<PendingSubmit>, "form">) {
    if (confirmedFormRef.current === event.currentTarget) {
      confirmedFormRef.current = null;
      return;
    }

    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setPendingSubmit({ form: event.currentTarget, ...pending });
  }

  function confirmSubmit() {
    if (!pendingSubmit) return;
    confirmedFormRef.current = pendingSubmit.form;
    const form = pendingSubmit.form;
    setPendingSubmit(null);
    window.setTimeout(() => form.requestSubmit(), 0);
  }

  return (
    <section className="bs-page">
      {notice ? (
        <div className={`bs-toast bs-toast--${notice.type}`}>
          {notice.type === "success" ? <CheckCircle2 size={18} /> : <CircleSlash size={18} />}
          <span>{notice.message}</span>
        </div>
      ) : null}

      <div className="bs-command-panel">
        <div className="bs-command-copy">
          <p className="bs-kicker">Basic Settings</p>
          <h1>ตั้งค่าข้อมูลพื้นฐาน</h1>
          <p>จัดการ dropdown, ค่ามาตรฐาน workload และข้อมูลอ้างอิงที่ใช้ร่วมกันในระบบทรัพย์สิน</p>
        </div>
        <div className="bs-command-summary">
          <div><strong>{optionGroups.length}</strong><span>กลุ่มข้อมูล</span></div>
          <div><strong>{totalOptions}</strong><span>รายการทั้งหมด</span></div>
        </div>
      </div>

      <div className="bs-stat-grid">
        <article className="bs-stat-card bs-stat-card--blue">
          <Settings2 size={22} />
          <div><span>แท็บที่เลือก</span><strong>{activeGroup?.title ?? "Workload"}</strong><p>พร้อมแก้ไขค่าได้ทันที</p></div>
        </article>
        <article className="bs-stat-card bs-stat-card--green">
          <Layers3 size={22} />
          <div><span>Dropdown options</span><strong>{totalOptions}</strong><p>รายการอ้างอิงในระบบ</p></div>
        </article>
        <article className="bs-stat-card bs-stat-card--amber">
          <Settings2 size={22} />
          <div><span>หมวดข้อมูล</span><strong>{optionGroups.length}</strong><p>กลุ่ม dropdown ทั้งหมด</p></div>
        </article>
      </div>

      <div className="bs-container">
        <nav className="bs-tab-nav" role="tablist">
          {optionGroups.map((group) => {
            const Icon = group.Icon;
            const count = optionsByType[group.type].length;
            const isActive = activeTab === group.tabId;
            return (
              <a key={group.tabId} href={`/admin/settings/basic?tab=${group.tabId}`} className={`bs-tab bs-accent-${group.accent}${isActive ? " is-active" : ""}`} role="tab" aria-selected={isActive}>
                <Icon size={18} />
                <span>{group.title}</span>
                <b>{count}</b>
              </a>
            );
          })}
        </nav>

        <div className="bs-body">
          {optionGroups.map((group) => (
            <OptionPanel
              key={group.type}
              group={group}
              options={optionsByType[group.type]}
              active={activeTab === group.tabId}
              onSubmit={interceptSubmit}
            />
          ))}
        </div>
      </div>

      {pendingSubmit ? (
        <div className="bs-confirm-backdrop">
          <div className={`bs-confirm-dialog is-${pendingSubmit.tone}`} role="alertdialog" aria-modal="true">
            <button type="button" className="bs-confirm-close" onClick={() => setPendingSubmit(null)} aria-label="ปิดหน้าต่างยืนยัน">
              <X size={17} />
            </button>
            <div className={`bs-confirm-icon bs-confirm-icon--${pendingSubmit.tone}`}>
              {pendingSubmit.tone === "danger" ? <Trash2 size={28} /> : <CheckCircle2 size={28} />}
            </div>
            <h3>{pendingSubmit.title}</h3>
            <p>{pendingSubmit.message}</p>
            <div className="bs-confirm-actions">
              <button type="button" className="button secondary" onClick={() => setPendingSubmit(null)}>ยกเลิก</button>
              <button type="button" className={`button ${pendingSubmit.tone === "danger" ? "danger" : ""}`} onClick={confirmSubmit}>
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function OptionPanel({
  group,
  options,
  active,
  onSubmit
}: {
  group: OptionGroup;
  options: AssetOption[];
  active: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>, pending: Omit<NonNullable<PendingSubmit>, "form">) => void;
}) {
  const Icon = group.Icon;
  const returnTo = `/admin/settings/basic?tab=${group.tabId}`;

  return (
    <div className="bs-panel" style={{ display: active ? "grid" : "none" }} role="tabpanel">
      <div className="bs-panel-header">
        <div className={`bs-panel-icon bs-accent-${group.accent}`}><Icon size={24} /></div>
        <div>
          <h3>{group.title}</h3>
          <p>{group.description}</p>
        </div>
        <span className={`bs-count-pill bs-accent-${group.accent}`}>{options.length} รายการ</span>
      </div>

      <form
        className="bs-add-form"
        action={addAssetOptionAction}
        onSubmit={(event) => onSubmit(event, {
          title: "ยืนยันการเพิ่มรายการ",
          message: `ระบบจะเพิ่มรายการใหม่ใน ${group.title}`,
          tone: "success"
        })}
      >
        <input type="hidden" name="type" value={group.type} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <input name="value" placeholder={group.placeholder} required className="bs-input" />
        <button className="bs-primary-button" type="submit">
          <Plus size={16} />
          เพิ่ม
        </button>
      </form>

      <div className="bs-option-list">
        {options.length === 0 ? (
          <div className="bs-empty">
            <div className={`bs-empty-icon bs-accent-${group.accent}`}><Icon size={28} /></div>
            <h3>ยังไม่มีรายการ</h3>
            <p>กรอกช่องด้านบนเพื่อเพิ่มตัวเลือกแรกของหมวดนี้</p>
          </div>
        ) : options.map((option, index) => (
          <div className="bs-option-row" key={option.id}>
            <span className="bs-option-number">{String(index + 1).padStart(2, "0")}</span>
            <form
              className="bs-edit-form"
              action={updateAssetOptionAction}
              onSubmit={(event) => onSubmit(event, {
                title: "ยืนยันการแก้ไขรายการ",
                message: `ระบบจะบันทึกค่าที่แก้ไขใน ${group.title}`,
                tone: "success"
              })}
            >
              <input type="hidden" name="optionId" value={option.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <input name="value" defaultValue={option.value} required className="bs-input" />
              <button className="bs-action-button" type="submit">
                <Pencil size={15} />
                บันทึก
              </button>
            </form>
            <form
              action={deleteAssetOptionAction}
              onSubmit={(event) => onSubmit(event, {
                title: "ยืนยันการลบรายการ",
                message: `ระบบจะลบ "${option.value}" ออกจาก ${group.title}`,
                tone: "danger"
              })}
            >
              <input type="hidden" name="optionId" value={option.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button className="bs-icon-danger" type="submit" aria-label={`ลบ ${option.value}`}>
                <Trash2 size={16} />
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
