"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createDailyInspectionAction, resetDailyInspectionAction } from "@/app/actions";
import { shiftDefaultSlots } from "@/lib/inspection-shifts";

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
  displayOrder: number;
  active: boolean;
}

interface InspectionFormProps {
  initialDataCenters: DataCenter[];
  initialSelectedDataCenterId: string;
  initialSelectedDate: string;
  initialCategories: ChecklistCategory[];
  initialExistingInspection: any;
  initialExistingResults: Record<string, { status: string; temperature: string; humidity: string; note: string }>;
  currentUserDisplayName: string;
}

const inspectionShiftOptions = [
  { value: "OFFICE_HOURS", label: "08:00 น. - 16.00 น. ในเวลาราชการ" },
  { value: "MORNING_SHIFT", label: "08:00 น. - 16.00 น. เวรเช้า" },
  { value: "AFTERNOON_SHIFT", label: "16.00 น. - 24.00 น. เวรบ่าย" },
  { value: "NIGHT_SHIFT", label: "24.00 น. - 08.00 น. เวรดึก" }
] as const;

const ALL_TIME_SLOTS = [
  { value: "SLOT_0800_0900", label: "08:00 - 09:00" },
  { value: "SLOT_0900_1000", label: "09:00 - 10:00" },
  { value: "SLOT_1100_1200", label: "11:00 - 12:00" },
  { value: "SLOT_1300_1400", label: "13:00 - 14:00" },
  { value: "SLOT_1400_1500", label: "14:00 - 15:00" },
  { value: "SLOT_1500_1600", label: "15:00 - 16:00" },
  { value: "SLOT_1600_1700", label: "16:00 - 17:00" },
  { value: "SLOT_1700_1800", label: "17:00 - 18:00" },
  { value: "SLOT_1800_1900", label: "18:00 - 19:00" },
  { value: "SLOT_1900_2000", label: "19:00 - 20:00" },
  { value: "SLOT_2000_2100", label: "20:00 - 21:00" },
  { value: "SLOT_2100_2200", label: "21:00 - 22:00" },
  { value: "SLOT_2200_2300", label: "22:00 - 23:00" },
  { value: "SLOT_2300_2400", label: "23:00 - 24:00" },
  { value: "SLOT_0000_0100", label: "00:00 - 01:00" },
  { value: "SLOT_0100_0200", label: "01:00 - 02:00" },
  { value: "SLOT_0200_0300", label: "02:00 - 03:00" },
  { value: "SLOT_0300_0400", label: "03:00 - 04:00" },
  { value: "SLOT_0400_0500", label: "04:00 - 05:00" },
  { value: "SLOT_0500_0600", label: "05:00 - 06:00" },
  { value: "SLOT_0600_0700", label: "06:00 - 07:00" },
  { value: "SLOT_0700_0800", label: "07:00 - 08:00" }
] as const;

export function InspectionForm({
  initialDataCenters,
  initialSelectedDataCenterId,
  initialSelectedDate,
  initialCategories,
  initialExistingInspection,
  initialExistingResults,
  currentUserDisplayName
}: InspectionFormProps) {
  const [dataCenters] = useState<DataCenter[]>(initialDataCenters);
  const [selectedDataCenterId, setSelectedDataCenterId] = useState<string>(initialSelectedDataCenterId);
  const [selectedDate, setSelectedDate] = useState<string>(initialSelectedDate);
  const [categories, setCategories] = useState<ChecklistCategory[]>(initialCategories);
  const [existingInspection, setExistingInspection] = useState<any>(initialExistingInspection);
  const [existingResults, setExistingResults] = useState<Record<string, { status: string; temperature: string; humidity: string; note: string }>>(initialExistingResults);
  const [formValues, setFormValues] = useState<Record<string, { status: string; temperature: string; humidity: string; note: string }>>(initialExistingResults);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showRefreshPopup, setShowRefreshPopup] = useState(false);
  const [showResetPopup, setShowResetPopup] = useState(false);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [inspectionShift, setInspectionShift] = useState<string>(initialExistingInspection?.inspectionShift || "OFFICE_HOURS");
  const [selectedSlots, setSelectedSlots] = useState<string[]>(
    initialExistingInspection?.timeSlot
      ? [initialExistingInspection.timeSlot]
      : []
  );

  const handleShiftChange = (shift: string) => {
    setInspectionShift(shift);
    setSelectedSlots([]);

    if (shift === "NIGHT_SHIFT") {
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);
      setSelectedDate(nextDay.toISOString().split("T")[0]);
    }
  };

  const toggleSlot = (slot: string) => {
    setSelectedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  };

  const handleInputChange = (itemId: string, field: string, value: string) => {
    setFormValues(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    try {
      // Log form data for debugging
      console.log("Form data being submitted:");
      for (const [key, value] of formData.entries()) {
        console.log(`${key}: ${value}`);
      }

      await createDailyInspectionAction(formData);
      setShowSuccessPopup(true);
      setTimeout(() => {
        setShowSuccessPopup(false);
      }, 3000);
      await fetchCategories();
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!selectedDataCenterId || !selectedDate) return;
    const confirmed = window.confirm("ต้องการรีเซ็ตข้อมูลการตรวจสอบของวันที่เลือกทั้งหมดใช่หรือไม่? ข้อมูลที่บันทึกไว้จะถูกลบและต้องบันทึกใหม่");
    if (!confirmed) return;

    setIsResetting(true);
    try {
      const formData = new FormData();
      formData.set("dataCenterId", selectedDataCenterId);
      formData.set("inspectionDate", selectedDate);
      formData.set("inspectionShift", inspectionShift);

      const result = await resetDailyInspectionAction(formData);
      if (!result.ok) throw new Error(result.error || "Reset failed");

      setExistingInspection(null);
      setExistingResults({});
      setFormValues({});
      setShowResetPopup(true);
      setTimeout(() => {
        setShowResetPopup(false);
      }, 2500);
      await fetchCategories();
    } catch (error) {
      console.error("Error resetting inspection:", error);
    } finally {
      setIsResetting(false);
    }
  };

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch(`/api/checklist-categories?dataCenterId=${selectedDataCenterId}`);
      if (!response.ok) throw new Error("Failed to fetch checklist categories");
      const data = await response.json();
      setCategories(Array.isArray(data) ? data : []);

      // Fetch existing inspection
      const inspectionResponse = await fetch(`/api/daily-inspections?dataCenterId=${selectedDataCenterId}&date=${selectedDate}`);
      if (!inspectionResponse.ok) throw new Error("Failed to fetch daily inspection");
      const inspectionData = await inspectionResponse.json();

      if (inspectionData) {
        setExistingInspection(inspectionData.inspection);
        setExistingResults(inspectionData.results || {});
        setFormValues(inspectionData.results || {});
        setInspectionShift(inspectionData.inspection?.inspectionShift || "OFFICE_HOURS");
        setSelectedSlots(inspectionData.inspection?.timeSlot ? [inspectionData.inspection.timeSlot] : []);
      } else {
        setExistingInspection(null);
        setExistingResults({});
        setFormValues({});
        setSelectedSlots([]);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }, [selectedDataCenterId, selectedDate]);

  useEffect(() => {
    if (selectedDataCenterId && selectedDate) {
      fetchCategories();
    }
  }, [selectedDataCenterId, selectedDate, fetchCategories]);

  const returnTo = `/checklist/inspection?dataCenterId=${encodeURIComponent(selectedDataCenterId)}&date=${encodeURIComponent(selectedDate)}`;

  return (
    <div className="grid">
      <section className="card">
        <form ref={formRef} action={handleSubmit} key={`${selectedDataCenterId}-${selectedDate}`}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="inspectorName" value={currentUserDisplayName} />
          <div className="toolbar" style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", padding: "1.5rem", borderRadius: "8px", marginBottom: "2rem" }}>
            <div className="form-row">
              <label style={{ color: "#ffffff" }}>
                Data Center
                <select 
                  name="dataCenterId" 
                  value={selectedDataCenterId}
                  onChange={(e) => setSelectedDataCenterId(e.target.value)}
                  required 
                  style={{ marginTop: "0.5rem" }}
                >
                  {dataCenters.map((dc) => (
                    <option key={dc.id} value={dc.id}>
                      {dc.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ color: "#ffffff" }}>
                วันที่ตรวจสอบ
                <input
                  type="date"
                  name="inspectionDate"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  required
                  style={{ marginTop: "0.5rem" }}
                />
              </label>
              <label style={{ color: "#ffffff" }}>
                ผู้ปฏิบัติงาน
                <input
                  value={currentUserDisplayName}
                  readOnly
                  style={{ marginTop: "0.5rem" }}
                />
              </label>
              <label style={{ color: "#ffffff" }}>
                ช่วงเวลา
                <select
                  name="inspectionShift"
                  value={inspectionShift}
                  onChange={(e) => handleShiftChange(e.target.value)}
                  required
                  style={{ marginTop: "0.5rem", minWidth: "220px" }}
                >
                  {inspectionShiftOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <div style={{ color: "#ffffff" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  ช่วงเวลาที่ตรวจสอบ (เลือกได้หลายช่วง)
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {ALL_TIME_SLOTS.filter((slot) => {
                    const allowed = shiftDefaultSlots[inspectionShift as keyof typeof shiftDefaultSlots];
                    return allowed && allowed.length > 0 ? allowed.includes(slot.value as any) : true;
                  }).map((slot) => {
                    const checked = selectedSlots.includes(slot.value);
                    return (
                      <label
                        key={slot.value}
                        style={{
                          display: "flex", alignItems: "center", gap: "0.35rem",
                          background: checked ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.2)",
                          color: checked ? "#4c1d95" : "#ffffff",
                          borderRadius: 8, padding: "0.3rem 0.65rem",
                          cursor: "pointer", fontSize: "0.82rem", fontWeight: checked ? 700 : 400,
                          border: checked ? "2px solid #fff" : "2px solid transparent",
                          transition: "all 0.15s"
                        }}
                      >
                        <input
                          type="checkbox"
                          name="timeSlots"
                          value={slot.value}
                          checked={checked}
                          onChange={() => toggleSlot(slot.value)}
                          style={{ accentColor: "#7c3aed" }}
                        />
                        {slot.label}
                      </label>
                    );
                  })}
                </div>
                {selectedSlots.length > 0 && (
                  <div style={{ fontSize: "0.78rem", marginTop: "0.5rem", color: "rgba(255,255,255,0.85)" }}>
                    เลือก {selectedSlots.length} ช่วง · workload ต่อรายการ ≈ {categories.reduce((s, c) => s + c.items.length, 0) > 0
                      ? Math.round((60 * selectedSlots.length) / categories.reduce((s, c) => s + c.items.length, 0))
                      : 0} นาที
                  </div>
                )}
                {selectedSlots.length === 0 && (
                  <div style={{ fontSize: "0.78rem", marginTop: "0.5rem", color: "rgba(255,255,255,0.9)" }}>
                    กรุณาเลือกช่วงเวลาอย่างน้อย 1 ช่วงก่อนบันทึก
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={async () => {
                  await fetchCategories();
                  setShowRefreshPopup(true);
                  setTimeout(() => {
                    setShowRefreshPopup(false);
                  }, 2000);
                }}
                style={{
                  background: "rgba(255, 255, 255, 0.9)",
                  color: "#667eea",
                  border: "none",
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  marginTop: "1.5rem"
                }}
              >
                รีเฟรชข้อมูล
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={isResetting || isSubmitting}
                style={{
                  background: "rgba(255, 255, 255, 0.9)",
                  color: "#b91c1c",
                  border: "1px solid rgba(255, 255, 255, 0.55)",
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: isResetting || isSubmitting ? "not-allowed" : "pointer",
                  marginTop: "1.5rem",
                  opacity: isResetting || isSubmitting ? 0.65 : 1
                }}
              >
                {isResetting ? "กำลังรีเซ็ต..." : "รีเซ็ตข้อมูล"}
              </button>
            </div>
          </div>

          {categories.map((category) => {
            const hasTemperature = category.items.some((item) => item.requiresTemperature);
            const hasHumidity = category.items.some((item) => item.requiresHumidity);
            const detailWidth = hasTemperature || hasHumidity ? "35%" : "42%";
            const statusWidth = hasTemperature || hasHumidity ? "20%" : "24%";
            const noteWidth = hasTemperature && hasHumidity ? "21%" : hasTemperature || hasHumidity ? "33%" : "34%";

            return (
              <div key={category.id} style={{ marginTop: "2rem" }}>
                <h3 style={{ marginBottom: "1rem", color: "#667eea" }}>{category.name}</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: detailWidth }}>รายละเอียด</th>
                        <th style={{ width: statusWidth }}>สถานะ</th>
                        {hasTemperature && <th style={{ width: "12%" }}>อุณหภูมิ (°C)</th>}
                        {hasHumidity && <th style={{ width: "12%" }}>ความชื้น (%)</th>}
                        <th style={{ width: noteWidth }}>หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {category.items.map((item) => {
                        const existing = formValues[item.id] || { status: "", temperature: "", humidity: "", note: "" };
                        return (
                          <tr key={item.id}>
                            <td>{item.name}</td>
                            <td>
                              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <input
                                    type="radio"
                                    name={`status_${item.id}`}
                                    value="NORMAL"
                                    checked={existing.status === "NORMAL"}
                                    onChange={(e) => handleInputChange(item.id, "status", e.target.value)}
                                    required
                                  />
                                  ปกติ
                                </label>
                                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <input
                                    type="radio"
                                    name={`status_${item.id}`}
                                    value="ABNORMAL"
                                    checked={existing.status === "ABNORMAL"}
                                    onChange={(e) => handleInputChange(item.id, "status", e.target.value)}
                                  />
                                  ผิดปกติ
                                </label>
                              </div>
                            </td>
                            {hasTemperature && (
                              <td>
                                {item.requiresTemperature ? (
                                  <input
                                    type="number"
                                    step="0.1"
                                    name={`temperature_${item.id}`}
                                    value={existing.temperature}
                                    onChange={(e) => handleInputChange(item.id, "temperature", e.target.value)}
                                    placeholder="-"
                                    style={{ width: "100%" }}
                                  />
                                ) : (
                                  "-"
                                )}
                              </td>
                            )}
                            {hasHumidity && (
                              <td>
                                {item.requiresHumidity ? (
                                  <input
                                    type="number"
                                    step="0.1"
                                    name={`humidity_${item.id}`}
                                    value={existing.humidity}
                                    onChange={(e) => handleInputChange(item.id, "humidity", e.target.value)}
                                    placeholder="-"
                                    style={{ width: "100%" }}
                                  />
                                ) : (
                                  "-"
                                )}
                              </td>
                            )}
                            <td>
                              <input
                                type="text"
                                name={`note_${item.id}`}
                                value={existing.note}
                                onChange={(e) => handleInputChange(item.id, "note", e.target.value)}
                                placeholder="-"
                                style={{ width: "100%" }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

           <div className="toolbar" style={{ marginTop: "2rem" }}>
            <button
              className="button"
              type="button"
              disabled={isSubmitting || selectedSlots.length === 0}
              onClick={() => setShowConfirmPopup(true)}
              style={{
                background: isSubmitting || selectedSlots.length === 0 ? "rgba(102, 126, 234, 0.5)" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                border: "none",
                color: "#ffffff",
                padding: "0.75rem 2rem",
                borderRadius: "8px",
                fontSize: "1rem",
                cursor: isSubmitting || selectedSlots.length === 0 ? "not-allowed" : "pointer"
              }}
            >
              {isSubmitting ? "กำลังบันทึก..." : "บันทึกผลการตรวจสอบ"}
            </button>
          </div>
         </form>

        {/* Confirmation Popup */}
        {showConfirmPopup && (
          <>
            <div
              onClick={() => setShowConfirmPopup(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.55)",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
                zIndex: 2000,
                animation: "fadeIn 0.25s ease"
              }}
            />
            <div
              style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                background: "rgba(255, 255, 255, 0.96)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderRadius: "20px",
                padding: "2.5rem 2.5rem 2rem",
                maxWidth: "440px",
                width: "90%",
                zIndex: 2001,
                boxShadow: "0 25px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.5) inset",
                textAlign: "center",
                animation: "popIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  margin: "0 auto 1.25rem",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.8rem",
                  boxShadow: "0 8px 24px rgba(102, 126, 234, 0.4)"
                }}
              >
                💾
              </div>
              <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.35rem", fontWeight: 700, color: "#1e293b" }}>
                ยืนยันการบันทึก
              </h3>
              <p style={{ margin: "0 0 1.5rem", fontSize: "0.9rem", color: "#64748b", lineHeight: 1.5 }}>
                กรุณาตรวจสอบข้อมูลให้ถูกต้องก่อนยืนยันการบันทึกผลการตรวจสอบ
              </p>

              <div style={{
                background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                borderRadius: "12px",
                padding: "1rem 1.25rem",
                marginBottom: "1.75rem",
                textAlign: "left",
                border: "1px solid rgba(102, 126, 234, 0.15)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
                  <span style={{ color: "#64748b" }}>Data Center</span>
                  <span style={{ color: "#1e293b", fontWeight: 600 }}>
                    {dataCenters.find(dc => dc.id === selectedDataCenterId)?.name || "—"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
                  <span style={{ color: "#64748b" }}>วันที่</span>
                  <span style={{ color: "#1e293b", fontWeight: 600 }}>
                    {new Date(selectedDate).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
                  <span style={{ color: "#64748b" }}>ช่วงเวลา</span>
                  <span style={{ color: "#1e293b", fontWeight: 600 }}>
                    {inspectionShiftOptions.find(s => s.value === inspectionShift)?.label || inspectionShift}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                  <span style={{ color: "#64748b" }}>รายการที่ตรวจสอบ</span>
                  <span style={{ color: "#1e293b", fontWeight: 600 }}>
                    {Object.values(formValues).filter(r => r.status).length} / {categories.reduce((sum, c) => sum + c.items.length, 0)}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowConfirmPopup(false)}
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    padding: "0.7rem 1rem",
                    borderRadius: "10px",
                    border: "1.5px solid #e2e8f0",
                    background: "#ffffff",
                    color: "#64748b",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                    opacity: isSubmitting ? 0.5 : 1
                  }}
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmPopup(false);
                    formRef.current?.requestSubmit();
                  }}
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    padding: "0.7rem 1rem",
                    borderRadius: "10px",
                    border: "none",
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "#ffffff",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(102, 126, 234, 0.4)",
                    transition: "all 0.2s",
                    opacity: isSubmitting ? 0.5 : 1
                  }}
                >
                  {isSubmitting ? "กำลังบันทึก..." : "ยืนยันบันทึก"}
                </button>
              </div>
            </div>
          </>
        )}

        {showSuccessPopup && (
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "#ffffff",
              padding: "2rem 3rem",
              borderRadius: "12px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
              zIndex: 1000,
              textAlign: "center",
              animation: "fadeIn 0.3s ease-in-out"
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✓</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>บันทึกสำเร็จ!</div>
          </div>
        )}

        {showRefreshPopup && (
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "#ffffff",
              padding: "2rem 3rem",
              borderRadius: "12px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
              zIndex: 1000,
              textAlign: "center",
              animation: "fadeIn 0.3s ease-in-out"
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔄</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>รีเฟรชข้อมูลแล้ว!</div>
          </div>
        )}

        {showResetPopup && (
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
              color: "#ffffff",
              padding: "2rem 3rem",
              borderRadius: "12px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
              zIndex: 1000,
              textAlign: "center",
              animation: "fadeIn 0.3s ease-in-out"
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✓</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>รีเซ็ตข้อมูลแล้ว</div>
            <div style={{ marginTop: "0.5rem" }}>กรอกข้อมูลใหม่แล้วกดบันทึกอีกครั้ง</div>
          </div>
        )}
      </section>
    </div>
  );
}
