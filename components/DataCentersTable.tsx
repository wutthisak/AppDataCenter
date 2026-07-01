"use client";

import { useMemo, useState } from "react";
import { Building2, CheckCircle2, CircleSlash, Edit3, Loader2, MapPin, MoreHorizontal, Plus, Power, Server, X } from "lucide-react";
import { DataCenterModal } from "@/components/DataCenterModal";

interface DataCenter {
  id: string;
  name: string;
  location: string | null;
  description: string | null;
  displayOrder: number;
  active: boolean;
}

interface DataCentersTableProps {
  initialDataCenters: DataCenter[];
}

type PendingAction = {
  type: "toggle";
  dataCenter: DataCenter;
} | null;

export function DataCentersTable({ initialDataCenters }: DataCentersTableProps) {
  const [dataCenters, setDataCenters] = useState<DataCenter[]>(initialDataCenters);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDataCenter, setEditingDataCenter] = useState<DataCenter | undefined>();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const stats = useMemo(() => {
    const total = dataCenters.length;
    const active = dataCenters.filter((dc) => dc.active).length;
    return {
      total,
      active,
      inactive: total - active
    };
  }, [dataCenters]);

  function showNotice(type: "success" | "error", message: string) {
    setNotice({ type, message });
    window.setTimeout(() => setNotice(null), 3200);
  }

  async function refreshDataCenters() {
    const response = await fetch("/api/datacenters");
    if (!response.ok) throw new Error("Failed to refresh data centers");
    const updatedData = await response.json();
    setDataCenters(updatedData);
  }

  function handleEdit(dc: DataCenter) {
    setEditingDataCenter(dc);
    setIsModalOpen(true);
  }

  function handleAdd() {
    setEditingDataCenter(undefined);
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    setEditingDataCenter(undefined);
  }

  async function handleSave(data: { name: string; location: string; description: string }) {
    try {
      const url = editingDataCenter ? `/api/datacenters/${editingDataCenter.id}` : "/api/datacenters";
      const method = editingDataCenter ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error("Failed to save");

      await refreshDataCenters();
      setIsModalOpen(false);
      setEditingDataCenter(undefined);
      showNotice("success", editingDataCenter ? "บันทึกข้อมูล Data Center เรียบร้อยแล้ว" : "เพิ่ม Data Center เรียบร้อยแล้ว");
    } catch {
      showNotice("error", "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
      throw new Error("Failed to save data center");
    }
  }

  async function handleToggleConfirmed() {
    if (!pendingAction) return;

    const target = pendingAction.dataCenter;
    setLoadingId(target.id);
    try {
      const response = await fetch(`/api/datacenters/${target.id}/toggle`, {
        method: "POST"
      });

      if (!response.ok) throw new Error("Failed to toggle");

      await refreshDataCenters();
      showNotice("success", target.active ? "ปิดใช้งาน Data Center เรียบร้อยแล้ว" : "เปิดใช้งาน Data Center เรียบร้อยแล้ว");
      setPendingAction(null);
    } catch {
      showNotice("error", "ไม่สามารถเปลี่ยนสถานะได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <section className="dc-page">
      {notice ? (
        <div className={`dc-toast dc-toast--${notice.type}`}>
          {notice.type === "success" ? <CheckCircle2 size={18} /> : <CircleSlash size={18} />}
          <span>{notice.message}</span>
        </div>
      ) : null}

      <div className="dc-command-panel">
        <div className="dc-command-copy">
          <p className="dc-kicker">Data Center Inventory</p>
          <h2>ห้อง Data Center</h2>
          <p>จัดการสถานที่ที่ใช้กับ checklist รายวัน ประวัติการตรวจ และรายงานกิจกรรม</p>
        </div>
        <button className="dc-primary-button" onClick={handleAdd}>
          <Plus size={17} />
          เพิ่ม Data Center
        </button>
      </div>

      <div className="dc-stat-grid">
        <article className="dc-stat-card dc-stat-card--total">
          <div className="dc-stat-icon"><Building2 size={22} /></div>
          <div>
            <span>ทั้งหมด</span>
            <strong>{stats.total}</strong>
            <p>Data Center ในระบบ</p>
          </div>
        </article>
        <article className="dc-stat-card dc-stat-card--active">
          <div className="dc-stat-icon"><CheckCircle2 size={22} /></div>
          <div>
            <span>ใช้งานอยู่</span>
            <strong>{stats.active}</strong>
            <p>{stats.total === 0 ? "ยังไม่มีข้อมูล" : `${Math.round((stats.active / stats.total) * 100)}% ของทั้งหมด`}</p>
          </div>
        </article>
        <article className="dc-stat-card dc-stat-card--inactive">
          <div className="dc-stat-icon"><CircleSlash size={22} /></div>
          <div>
            <span>ปิดใช้งาน</span>
            <strong>{stats.inactive}</strong>
            <p>ไม่แสดงใน workflow หลัก</p>
          </div>
        </article>
      </div>

      <div className="dc-list-panel">
        <div className="dc-list-head">
          <div>
            <h2>รายการ Data Center</h2>
            <p>แก้ไขรายละเอียด หรือเปิด/ปิดการใช้งานด้วยเมนู action</p>
          </div>
          <span className="dc-count-pill">{dataCenters.length} รายการ</span>
        </div>

        {dataCenters.length === 0 ? (
          <div className="dc-empty">
            <div className="dc-empty-icon"><Building2 size={30} /></div>
            <h3>ยังไม่มี Data Center</h3>
            <p>เพิ่มรายการแรกเพื่อเริ่มใช้งาน checklist และรายงานประจำวัน</p>
            <button className="dc-primary-button" onClick={handleAdd}>
              <Plus size={17} />
              เพิ่ม Data Center
            </button>
          </div>
        ) : (
          <div className="dc-card-list">
            {dataCenters.map((dc) => (
              <article className={`dc-row-card ${dc.active ? "" : "is-inactive"}`} key={dc.id}>
                <div className="dc-row-main">
                  <div className="dc-row-mark">
                    <Server size={21} />
                    <span>{dc.displayOrder}</span>
                  </div>
                  <div className="dc-row-copy">
                    <div className="dc-row-title-line">
                      <h3>{dc.name}</h3>
                      <span className={`dc-status-badge ${dc.active ? "is-active" : "is-inactive"}`}>
                        {dc.active ? "ใช้งานอยู่" : "ปิดใช้งาน"}
                      </span>
                    </div>
                    <div className="dc-row-location">
                      <MapPin size={14} />
                      {dc.location || "ยังไม่ได้ระบุสถานที่"}
                    </div>
                    <p>{dc.description || "ไม่มีคำอธิบายเพิ่มเติม"}</p>
                  </div>
                </div>

                <div className="dc-row-actions">
                  <button className="dc-action-button" onClick={() => handleEdit(dc)}>
                    <Edit3 size={16} />
                    แก้ไข
                  </button>
                  <button
                    className={`dc-action-button ${dc.active ? "is-danger" : "is-success"}`}
                    onClick={() => setPendingAction({ type: "toggle", dataCenter: dc })}
                    disabled={loadingId === dc.id}
                  >
                    {loadingId === dc.id ? <Loader2 className="dc-spin" size={16} /> : <Power size={16} />}
                    {dc.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                  </button>
                  <details className="dc-more-menu">
                    <summary aria-label={`เมนู ${dc.name}`}>
                      <MoreHorizontal size={20} />
                    </summary>
                    <div className="dc-more-popover">
                      <button onClick={() => handleEdit(dc)}>
                        <Edit3 size={15} />
                        แก้ไขรายละเอียด
                      </button>
                      <button onClick={() => setPendingAction({ type: "toggle", dataCenter: dc })}>
                        <Power size={15} />
                        {dc.active ? "ปิดใช้งานรายการนี้" : "เปิดใช้งานรายการนี้"}
                      </button>
                    </div>
                  </details>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <DataCenterModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        dataCenter={editingDataCenter}
        onSave={handleSave}
      />

      {pendingAction ? (
        <div className="dc-confirm-backdrop">
          <div className={`dc-confirm-dialog ${pendingAction.dataCenter.active ? "is-danger" : "is-success"}`} role="alertdialog" aria-modal="true">
            <button type="button" className="dc-confirm-close" onClick={() => setPendingAction(null)} aria-label="ปิดหน้าต่างยืนยัน">
              <X size={17} />
            </button>
            <div className={`dc-confirm-icon ${pendingAction.dataCenter.active ? "dc-confirm-icon--danger" : "dc-confirm-icon--success"}`}>
              {pendingAction.dataCenter.active ? <CircleSlash size={28} /> : <CheckCircle2 size={28} />}
            </div>
            <h3>{pendingAction.dataCenter.active ? "ยืนยันการปิดใช้งาน" : "ยืนยันการเปิดใช้งาน"}</h3>
            <p>
              {pendingAction.dataCenter.active
                ? `${pendingAction.dataCenter.name} จะถูกปิดใช้งานและอาจไม่ปรากฏใน workflow บางส่วน`
                : `${pendingAction.dataCenter.name} จะกลับมาใช้งานในระบบได้อีกครั้ง`}
            </p>
            <div className="dc-confirm-actions">
              <button type="button" className="button secondary" onClick={() => setPendingAction(null)} disabled={Boolean(loadingId)}>ยกเลิก</button>
              <button type="button" className={`button ${pendingAction.dataCenter.active ? "danger" : ""}`} onClick={handleToggleConfirmed} disabled={Boolean(loadingId)}>
                {loadingId ? "กำลังดำเนินการ..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
