"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleSlash,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Droplets,
  Edit3,
  Layers3,
  Loader2,
  Plus,
  Power,
  Server,
  Thermometer,
  X
} from "lucide-react";
import { ChecklistCategoryModal } from "@/components/ChecklistCategoryModal";
import { ChecklistItemModal } from "@/components/ChecklistItemModal";
import {
  createChecklistCategoryAction,
  updateChecklistCategoryAction,
  toggleChecklistCategoryAction,
  createChecklistItemAction,
  updateChecklistItemAction,
  toggleChecklistItemAction
} from "@/app/actions";

interface DataCenter {
  id: string;
  name: string;
  location: string | null;
  description: string | null;
  displayOrder: number;
  active: boolean;
}

interface ChecklistCategory {
  id: string;
  name: string;
  dataCenterId: string;
  displayOrder: number;
  active: boolean;
  items: ChecklistItem[];
}

interface ChecklistItem {
  id: string;
  categoryId: string;
  name: string;
  requiresTemperature: boolean;
  requiresHumidity: boolean;
  estimatedDurationMin: number;
  displayOrder: number;
  active: boolean;
}

interface ChecklistAdminProps {
  initialDataCenters: DataCenter[];
}

type PendingAction =
  | { type: "category"; target: ChecklistCategory }
  | { type: "item"; target: ChecklistItem; categoryName: string }
  | null;

export function ChecklistAdmin({ initialDataCenters }: ChecklistAdminProps) {
  const [dataCenters] = useState<DataCenter[]>(initialDataCenters);
  const [selectedDataCenterId, setSelectedDataCenterId] = useState<string>(initialDataCenters[0]?.id || "");
  const [categories, setCategories] = useState<ChecklistCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ChecklistCategory | undefined>();
  const [editingItem, setEditingItem] = useState<ChecklistItem | undefined>();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const selectedDataCenter = dataCenters.find((dc) => dc.id === selectedDataCenterId);

  const stats = useMemo(() => {
    const items = categories.flatMap((category) => category.items);
    const activeCategories = categories.filter((category) => category.active).length;
    const activeItems = items.filter((item) => item.active).length;
    const workload = items.reduce((total, item) => total + (item.active ? item.estimatedDurationMin : 0), 0);
    return {
      categories: categories.length,
      activeCategories,
      items: items.length,
      activeItems,
      workload
    };
  }, [categories]);

  const fetchCategories = useCallback(async () => {
    if (!selectedDataCenterId) {
      setCategories([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/checklist-categories?dataCenterId=${selectedDataCenterId}`);
      if (!response.ok) throw new Error("Failed to fetch checklist categories");
      const data = await response.json();
      setCategories(data);
    } catch {
      showNotice("error", "ไม่สามารถโหลดรายการ Checklist ได้");
    } finally {
      setLoading(false);
    }
  }, [selectedDataCenterId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  function showNotice(type: "success" | "error", message: string) {
    setNotice({ type, message });
    window.setTimeout(() => setNotice(null), 3200);
  }

  function handleAddCategory() {
    setEditingCategory(undefined);
    setIsCategoryModalOpen(true);
  }

  function handleEditCategory(category: ChecklistCategory) {
    setEditingCategory(category);
    setIsCategoryModalOpen(true);
  }

  async function handleSaveCategory(data: { name: string; dataCenterId: string }) {
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("dataCenterId", data.dataCenterId);
    if (editingCategory) formData.append("id", editingCategory.id);

    try {
      const result = editingCategory
        ? await updateChecklistCategoryAction(formData)
        : await createChecklistCategoryAction(formData);
      if (result && (result as { error?: string }).error) throw new Error("Failed to save category");
      await fetchCategories();
      setIsCategoryModalOpen(false);
      setEditingCategory(undefined);
      showNotice("success", editingCategory ? "บันทึกหมวดหมู่เรียบร้อยแล้ว" : "เพิ่มหมวดหมู่เรียบร้อยแล้ว");
    } catch {
      showNotice("error", "ไม่สามารถบันทึกหมวดหมู่ได้");
      throw new Error("Failed to save category");
    }
  }

  function handleAddItem(categoryId: string) {
    setSelectedCategoryId(categoryId);
    setEditingItem(undefined);
    setIsItemModalOpen(true);
  }

  function handleEditItem(item: ChecklistItem) {
    setSelectedCategoryId(item.categoryId);
    setEditingItem(item);
    setIsItemModalOpen(true);
  }

  async function handleSaveItem(data: { name: string; requiresTemperature: boolean; requiresHumidity: boolean; estimatedDurationMin: number }) {
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("requiresTemperature", data.requiresTemperature ? "true" : "false");
    formData.append("requiresHumidity", data.requiresHumidity ? "true" : "false");
    formData.append("estimatedDurationMin", String(data.estimatedDurationMin));
    formData.append("categoryId", selectedCategoryId);
    if (editingItem) formData.append("id", editingItem.id);

    try {
      const result = editingItem
        ? await updateChecklistItemAction(formData)
        : await createChecklistItemAction(formData);
      if (result && (result as { error?: string }).error) throw new Error("Failed to save item");
      await fetchCategories();
      setIsItemModalOpen(false);
      setEditingItem(undefined);
      showNotice("success", editingItem ? "บันทึกรายการตรวจสอบเรียบร้อยแล้ว" : "เพิ่มรายการตรวจสอบเรียบร้อยแล้ว");
    } catch {
      showNotice("error", "ไม่สามารถบันทึกรายการตรวจสอบได้");
      throw new Error("Failed to save item");
    }
  }

  async function handleToggleConfirmed() {
    if (!pendingAction) return;

    const formData = new FormData();
    formData.append("id", pendingAction.target.id);
    setLoadingActionId(pendingAction.target.id);

    try {
      const result = pendingAction.type === "category"
        ? await toggleChecklistCategoryAction(formData)
        : await toggleChecklistItemAction(formData);
      if (result && (result as { error?: string }).error) throw new Error("Failed to toggle");
      await fetchCategories();
      showNotice("success", pendingAction.target.active ? "ปิดใช้งานเรียบร้อยแล้ว" : "เปิดใช้งานเรียบร้อยแล้ว");
      setPendingAction(null);
    } catch {
      showNotice("error", "ไม่สามารถเปลี่ยนสถานะได้");
    } finally {
      setLoadingActionId(null);
    }
  }

  return (
    <section className="cl-page">
      {notice ? (
        <div className={`cl-toast cl-toast--${notice.type}`}>
          {notice.type === "success" ? <CheckCircle2 size={18} /> : <CircleSlash size={18} />}
          <span>{notice.message}</span>
        </div>
      ) : null}

      <div className="cl-command-panel">
        <div className="cl-command-copy">
          <p className="cl-kicker">Checklist Builder</p>
          <h2>โครงสร้างการตรวจสอบรายวัน</h2>
          <p>จัดหมวดหมู่ รายการตรวจ อุณหภูมิ ความชื้น และ workload ให้ตรงกับแต่ละ Data Center</p>
        </div>
        <button className="cl-primary-button" onClick={handleAddCategory} disabled={!selectedDataCenterId}>
          <Plus size={17} />
          เพิ่มหมวดหมู่
        </button>
      </div>

      <div className="cl-selector-panel">
        <div className="cl-selector-label">
          <Server size={18} />
          <div>
            <strong>Data Center</strong>
            <span>{selectedDataCenter?.location || "เลือกพื้นที่สำหรับตั้งค่า Checklist"}</span>
          </div>
        </div>
        <select value={selectedDataCenterId} onChange={(event) => setSelectedDataCenterId(event.target.value)}>
          {dataCenters.map((dc) => (
            <option key={dc.id} value={dc.id}>{dc.name}</option>
          ))}
        </select>
      </div>

      <div className="cl-stat-grid">
        <article className="cl-stat-card cl-stat-card--blue">
          <div className="cl-stat-icon"><Layers3 size={22} /></div>
          <div><span>หมวดหมู่</span><strong>{stats.categories}</strong><p>{stats.activeCategories} เปิดใช้งาน</p></div>
        </article>
        <article className="cl-stat-card cl-stat-card--green">
          <div className="cl-stat-icon"><ClipboardCheck size={22} /></div>
          <div><span>รายการตรวจ</span><strong>{stats.items}</strong><p>{stats.activeItems} เปิดใช้งาน</p></div>
        </article>
        <article className="cl-stat-card cl-stat-card--amber">
          <div className="cl-stat-icon"><Clock3 size={22} /></div>
          <div><span>Workload</span><strong>{stats.workload}</strong><p>นาทีโดยประมาณ</p></div>
        </article>
      </div>

      <div className="cl-list-panel">
        <div className="cl-list-head">
          <div>
            <h2>หมวดหมู่และรายการตรวจสอบ</h2>
            <p>แก้ไขหรือเปิด/ปิดการใช้งาน โดยระบบจะถามยืนยันก่อนทุก action สำคัญ</p>
          </div>
          <span className="cl-count-pill">{categories.length} หมวดหมู่</span>
        </div>

        {loading ? (
          <div className="cl-loading"><Loader2 className="cl-spin" size={22} /> กำลังโหลด Checklist...</div>
        ) : categories.length === 0 ? (
          <div className="cl-empty">
            <div className="cl-empty-icon"><ClipboardList size={30} /></div>
            <h3>ยังไม่มีหมวดหมู่ Checklist</h3>
            <p>เพิ่มหมวดหมู่แรกเพื่อเริ่มตั้งค่ารายการตรวจสอบประจำวัน</p>
            <button className="cl-primary-button" onClick={handleAddCategory} disabled={!selectedDataCenterId}>
              <Plus size={17} />
              เพิ่มหมวดหมู่
            </button>
          </div>
        ) : (
          <div className="cl-category-list">
            {categories.map((category) => {
              const activeItems = category.items.filter((item) => item.active).length;
              const hasTemperature = category.items.some((item) => item.requiresTemperature);
              const hasHumidity = category.items.some((item) => item.requiresHumidity);

              return (
                <article className={`cl-category-card ${category.active ? "" : "is-inactive"}`} key={category.id}>
                  <div className="cl-category-head">
                    <div className="cl-category-main">
                      <div className="cl-category-mark">
                        <ClipboardList size={21} />
                        <span>{category.displayOrder}</span>
                      </div>
                      <div>
                        <div className="cl-title-row">
                          <h3>{category.name}</h3>
                          <span className={`cl-status-badge ${category.active ? "is-active" : "is-inactive"}`}>
                            {category.active ? "ใช้งานอยู่" : "ปิดใช้งาน"}
                          </span>
                        </div>
                        <p>{activeItems} active / {category.items.length} total {hasTemperature ? " • มีอุณหภูมิ" : ""}{hasHumidity ? " • มีความชื้น" : ""}</p>
                      </div>
                    </div>
                    <div className="cl-action-row">
                      <button className="cl-action-button" onClick={() => handleAddItem(category.id)}>
                        <Plus size={16} />
                        เพิ่มรายการ
                      </button>
                      <button className="cl-action-button" onClick={() => handleEditCategory(category)}>
                        <Edit3 size={16} />
                        แก้ไข
                      </button>
                      <button
                        className={`cl-action-button ${category.active ? "is-danger" : "is-success"}`}
                        onClick={() => setPendingAction({ type: "category", target: category })}
                        disabled={loadingActionId === category.id}
                      >
                        {loadingActionId === category.id ? <Loader2 className="cl-spin" size={16} /> : <Power size={16} />}
                        {category.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                      </button>
                    </div>
                  </div>

                  {category.items.length === 0 ? (
                    <div className="cl-items-empty">
                      <span>ยังไม่มีรายการตรวจสอบในหมวดหมู่นี้</span>
                      <button onClick={() => handleAddItem(category.id)}>เพิ่มรายการแรก</button>
                    </div>
                  ) : (
                    <div className="cl-item-list">
                      {category.items.map((item) => (
                        <div className={`cl-item-row ${item.active ? "" : "is-inactive"}`} key={item.id}>
                          <div className="cl-item-main">
                            <span className="cl-item-order">{item.displayOrder}</span>
                            <div>
                              <div className="cl-item-title">{item.name}</div>
                              <div className="cl-item-meta">
                                <span><Clock3 size={13} /> {item.estimatedDurationMin} นาที</span>
                                {item.requiresTemperature ? <span><Thermometer size={13} /> อุณหภูมิ</span> : null}
                                {item.requiresHumidity ? <span><Droplets size={13} /> ความชื้น</span> : null}
                              </div>
                            </div>
                          </div>
                          <div className="cl-item-actions">
                            <span className={`cl-status-badge ${item.active ? "is-active" : "is-inactive"}`}>
                              {item.active ? "ACTIVE" : "INACTIVE"}
                            </span>
                            <button className="cl-icon-action" onClick={() => handleEditItem(item)} aria-label={`แก้ไข ${item.name}`}>
                              <Edit3 size={15} />
                            </button>
                            <button
                              className={`cl-icon-action ${item.active ? "is-danger" : "is-success"}`}
                              onClick={() => setPendingAction({ type: "item", target: item, categoryName: category.name })}
                              disabled={loadingActionId === item.id}
                              aria-label={item.active ? `ปิดใช้งาน ${item.name}` : `เปิดใช้งาน ${item.name}`}
                            >
                              {loadingActionId === item.id ? <Loader2 className="cl-spin" size={15} /> : <Power size={15} />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <ChecklistCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setEditingCategory(undefined);
        }}
        category={editingCategory}
        dataCenterId={selectedDataCenterId}
        onSave={handleSaveCategory}
      />

      <ChecklistItemModal
        isOpen={isItemModalOpen}
        onClose={() => {
          setIsItemModalOpen(false);
          setEditingItem(undefined);
        }}
        item={editingItem}
        categoryId={selectedCategoryId}
        onSave={handleSaveItem}
      />

      {pendingAction ? (
        <div className="cl-confirm-backdrop">
          <div className={`cl-confirm-dialog ${pendingAction.target.active ? "is-danger" : "is-success"}`} role="alertdialog" aria-modal="true">
            <button type="button" className="cl-confirm-close" onClick={() => setPendingAction(null)} aria-label="ปิดหน้าต่างยืนยัน">
              <X size={17} />
            </button>
            <div className={`cl-confirm-icon ${pendingAction.target.active ? "cl-confirm-icon--danger" : "cl-confirm-icon--success"}`}>
              {pendingAction.target.active ? <CircleSlash size={28} /> : <CheckCircle2 size={28} />}
            </div>
            <h3>{pendingAction.target.active ? "ยืนยันการปิดใช้งาน" : "ยืนยันการเปิดใช้งาน"}</h3>
            <p>
              {pendingAction.type === "category"
                ? `${pendingAction.target.name} จะถูก${pendingAction.target.active ? "ปิด" : "เปิด"}ใช้งานในชุด Checklist นี้`
                : `${pendingAction.target.name} ในหมวด ${pendingAction.categoryName} จะถูก${pendingAction.target.active ? "ปิด" : "เปิด"}ใช้งาน`}
            </p>
            <div className="cl-confirm-actions">
              <button type="button" className="button secondary" onClick={() => setPendingAction(null)} disabled={Boolean(loadingActionId)}>ยกเลิก</button>
              <button type="button" className={`button ${pendingAction.target.active ? "danger" : ""}`} onClick={handleToggleConfirmed} disabled={Boolean(loadingActionId)}>
                {loadingActionId ? "กำลังดำเนินการ..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
