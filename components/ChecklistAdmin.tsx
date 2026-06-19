"use client";

import { useState, useEffect } from "react";
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

export function ChecklistAdmin({ initialDataCenters }: ChecklistAdminProps) {
  const [dataCenters] = useState<DataCenter[]>(initialDataCenters);
  const [selectedDataCenterId, setSelectedDataCenterId] = useState<string>(
    initialDataCenters[0]?.id || ""
  );
  const [categories, setCategories] = useState<ChecklistCategory[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ChecklistCategory | undefined>();
  const [editingItem, setEditingItem] = useState<ChecklistItem | undefined>();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  useEffect(() => {
    if (selectedDataCenterId) {
      fetchCategories();
    }
  }, [selectedDataCenterId]);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`/api/checklist-categories?dataCenterId=${selectedDataCenterId}`);
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const handleAddCategory = () => {
    setEditingCategory(undefined);
    setIsCategoryModalOpen(true);
  };

  const handleEditCategory = (category: ChecklistCategory) => {
    setEditingCategory(category);
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (data: { name: string; dataCenterId: string }) => {
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("dataCenterId", data.dataCenterId);
    if (editingCategory) {
      formData.append("id", editingCategory.id);
    }

    try {
      const result = editingCategory
        ? await updateChecklistCategoryAction(formData)
        : await createChecklistCategoryAction(formData);
      if (result && (result as { error?: string }).error) {
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        return;
      }
      await fetchCategories();
      setIsCategoryModalOpen(false);
      setEditingCategory(undefined);
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  };

  const handleToggleCategory = async (id: string) => {
    const formData = new FormData();
    formData.append("id", id);

    try {
      const result = await toggleChecklistCategoryAction(formData);
      if (result && (result as { error?: string }).error) {
        alert("เกิดข้อผิดพลาดในการเปลี่ยนสถานะ");
        return;
      }
      await fetchCategories();
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการเปลี่ยนสถานะ");
    }
  };

  const handleAddItem = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setEditingItem(undefined);
    setIsItemModalOpen(true);
  };

  const handleEditItem = (item: ChecklistItem) => {
    setSelectedCategoryId(item.categoryId);
    setEditingItem(item);
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (data: { name: string; requiresTemperature: boolean; requiresHumidity: boolean; estimatedDurationMin: number }) => {
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("requiresTemperature", data.requiresTemperature ? "true" : "false");
    formData.append("requiresHumidity", data.requiresHumidity ? "true" : "false");
    formData.append("estimatedDurationMin", String(data.estimatedDurationMin));
    formData.append("categoryId", selectedCategoryId);
    if (editingItem) {
      formData.append("id", editingItem.id);
    }

    try {
      const result = editingItem
        ? await updateChecklistItemAction(formData)
        : await createChecklistItemAction(formData);
      if (result && (result as { error?: string }).error) {
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        return;
      }
      await fetchCategories();
      setIsItemModalOpen(false);
      setEditingItem(undefined);
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  };

  const handleToggleItem = async (id: string) => {
    const formData = new FormData();
    formData.append("id", id);

    try {
      const result = await toggleChecklistItemAction(formData);
      if (result && (result as { error?: string }).error) {
        alert("เกิดข้อผิดพลาดในการเปลี่ยนสถานะ");
        return;
      }
      await fetchCategories();
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการเปลี่ยนสถานะ");
    }
  };

  return (
    <>
      <div className="grid">
        <section className="card">
          <div className="toolbar" style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", padding: "1.5rem", borderRadius: "8px", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ color: "#ffffff" }}>
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "bold" }}>เลือก Data Center</h2>
              </div>
              <select
                value={selectedDataCenterId}
                onChange={(e) => setSelectedDataCenterId(e.target.value)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                  color: "#111827",
                  fontSize: "1rem",
                  minWidth: "200px"
                }}
              >
                {dataCenters.map((dc) => (
                  <option key={dc.id} value={dc.id}>
                    {dc.name}
                  </option>
                ))}
              </select>
              <div style={{ color: "#ffffff", marginLeft: "auto" }}>
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "bold" }}>หมวดหมู่</h2>
              </div>
              <button
                className="button"
                onClick={handleAddCategory}
                style={{
                  background: "rgba(255, 255, 255, 0.9)",
                  color: "#667eea",
                  border: "none",
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  fontWeight: "bold"
                }}
              >
                + เพิ่มหมวดหมู่ใหม่
              </button>
            </div>
          </div>

          {categories.map((category) => {
            const hasTemperature = category.items.some(item => item.requiresTemperature);
            const hasHumidity = category.items.some(item => item.requiresHumidity);

            return (
              <div key={category.id} style={{ marginTop: "2rem" }}>
                <div className="toolbar" style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", padding: "1rem 1.5rem", borderRadius: "8px", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                    <div style={{ color: "#ffffff" }}>
                      <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "bold" }}>{category.name}</h3>
                      <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.875rem", opacity: 0.9 }}>{category.items.filter((item) => item.active).length} active / {category.items.length} total</p>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        className="button secondary"
                        onClick={() => handleEditCategory(category)}
                        style={{
                          background: "rgba(255, 255, 255, 0.9)",
                          color: "#667eea",
                          border: "none",
                          padding: "0.5rem 1rem",
                          borderRadius: "6px",
                          fontWeight: "bold"
                        }}
                      >
                        แก้ไข
                      </button>
                      <button
                        className={`button ${category.active ? "danger" : "secondary"}`}
                        onClick={() => handleToggleCategory(category.id)}
                        style={{
                          background: category.active ? "rgba(239, 68, 68, 0.9)" : "rgba(255, 255, 255, 0.9)",
                          color: category.active ? "#ffffff" : "#667eea",
                          border: "none",
                          padding: "0.5rem 1rem",
                          borderRadius: "6px",
                          fontWeight: "bold"
                        }}
                      >
                        {category.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="toolbar" style={{ marginBottom: "1rem" }}>
                  <button
                    className="button secondary"
                    onClick={() => handleAddItem(category.id)}
                    style={{
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      color: "#ffffff",
                      border: "none",
                      padding: "0.5rem 1rem",
                      borderRadius: "6px",
                      fontWeight: "bold"
                    }}
                  >
                    + เพิ่มรายการตรวจสอบ
                  </button>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 90 }}>ลำดับ</th>
                        <th>ชื่อรายการ</th>
                        {hasTemperature && <th style={{ width: 120 }}>อุณหภูมิ</th>}
                        {hasHumidity && <th style={{ width: 120 }}>ความชื้น</th>}
                        <th style={{ width: 100 }}>เวลา</th>
                        <th>สถานะ</th>
                        <th style={{ width: 200 }}>จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {category.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.displayOrder}</td>
                          <td>{item.name}</td>
                          {hasTemperature && <td>{item.requiresTemperature ? "✓" : "-"}</td>}
                          {hasHumidity && <td>{item.requiresHumidity ? "✓" : "-"}</td>}
                          <td>{item.estimatedDurationMin} นาที</td>
                          <td><span className={`badge ${item.active ? "" : "locked"}`}>{item.active ? "ACTIVE" : "INACTIVE"}</span></td>
                          <td>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <button
                                className="button secondary"
                                onClick={() => handleEditItem(item)}
                                style={{
                                  padding: "0.25rem 0.75rem",
                                  fontSize: "0.875rem"
                                }}
                              >
                                แก้ไข
                              </button>
                              <button
                                className={`button ${item.active ? "danger" : "secondary"}`}
                                onClick={() => handleToggleItem(item.id)}
                                style={{
                                  padding: "0.25rem 0.75rem",
                                  fontSize: "0.875rem"
                                }}
                              >
                                {item.active ? "ปิด" : "เปิด"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </section>
      </div>

      {isCategoryModalOpen && (
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
      )}

      {isItemModalOpen && (
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
      )}
    </>
  );
}
