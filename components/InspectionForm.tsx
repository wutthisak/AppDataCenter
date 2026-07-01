"use client";

import { Fragment, useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { createDailyInspectionAction, resetDailyInspectionAction } from "@/app/actions";
import { getDefaultInspectionSelection, shiftDefaultSlots } from "@/lib/inspection-shifts";
import { ClipboardCheck, RefreshCw, RotateCcw, Save, X, Check, AlertTriangle, Building2, Calendar, Clock, Search, Thermometer, Droplets, FileText } from "lucide-react";

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
  initialSelectedTimeSlot?: string;
  initialCategories: ChecklistCategory[];
  initialExistingInspection: any;
  initialExistingResults: Record<string, { status: string; temperature: string; humidity: string; note: string }>;
  currentUserDisplayName: string;
}

const inspectionShiftOptions = [
  { value: "OFFICE_HOURS",    label: "ในเวลาราชการ 08:00 - 16:00" },
  { value: "MORNING_SHIFT",   label: "เวรเช้า 08:00 - 16:00" },
  { value: "AFTERNOON_SHIFT", label: "เวรบ่าย 16:00 - 24:00" },
  { value: "NIGHT_SHIFT",     label: "เวรดึก 00:00 - 08:00" }
] as const;

const durationOptions = [5, 10, 15, 30, 45, 60] as const;

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

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTimeInput(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function parseSlotStart(slot: string) {
  const matched = ALL_TIME_SLOTS.find((it) => it.value === slot);
  if (!matched) return "08:00";
  return matched.label.split("-")[0]?.trim() ?? "08:00";
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function localDateTimeFromDateAndTime(dateText: string, hhmm: string) {
  const [hour, minute] = hhmm.split(":").map((v) => Number(v));
  const base = new Date(`${dateText}T00:00:00`);
  base.setHours(Number.isFinite(hour) ? hour : 0, Number.isFinite(minute) ? minute : 0, 0, 0);
  return base;
}

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  text: string;
  sub?: string;
}

export function InspectionForm({
  initialDataCenters,
  initialSelectedDataCenterId,
  initialSelectedDate,
  initialSelectedTimeSlot,
  initialCategories,
  initialExistingInspection,
  initialExistingResults,
  currentUserDisplayName
}: InspectionFormProps) {
  const [dataCenters] = useState<DataCenter[]>(initialDataCenters);
  const [selectedDataCenterId, setSelectedDataCenterId] = useState<string>(initialSelectedDataCenterId);
  const [selectedDate, setSelectedDate] = useState<string>(initialSelectedDate);
  const [categories, setCategories] = useState<ChecklistCategory[]>(initialCategories);
  const [formValues, setFormValues] = useState<Record<string, { status: string; temperature: string; humidity: string; note: string }>>(initialExistingResults);
  const [inspectedSlots, setInspectedSlots] = useState<string[]>([]);
  const [selectedDurationMinutes, setSelectedDurationMinutes] = useState<number>(15);
  const [confirmAction, setConfirmAction] = useState<"save" | "reset" | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const initialSelection = getDefaultInspectionSelection(initialExistingInspection?.timeSlot || initialSelectedTimeSlot);
  const [inspectionShift, setInspectionShift] = useState<string>(initialExistingInspection?.inspectionShift || "MORNING_SHIFT");
  const [selectedSlots, setSelectedSlots] = useState<string[]>(
    initialExistingInspection?.timeSlot
      ? [initialExistingInspection.timeSlot]
      : initialSelectedTimeSlot
        ? [initialSelectedTimeSlot]
      : [initialSelection.timeSlot]
  );
  const activeTimeSlot = selectedSlots[0] ?? "";
  const allowedSlots = shiftDefaultSlots[inspectionShift as keyof typeof shiftDefaultSlots] ?? [];
  const totalSlotsInShift = allowedSlots.length;
  const inspectedSlotsInShift = allowedSlots.filter((slot) => inspectedSlots.includes(slot)).length;
  const activeSlotLabel = ALL_TIME_SLOTS.find((slot) => slot.value === activeTimeSlot)?.label ?? "-";
  const isActiveSlotInspected = Boolean(activeTimeSlot && inspectedSlots.includes(activeTimeSlot));
  const slotStartDate = localDateTimeFromDateAndTime(selectedDate, parseSlotStart(activeTimeSlot));
  const slotEndDate = addMinutes(slotStartDate, selectedDurationMinutes);
  const computedStartDateTime = formatDateTimeInput(slotStartDate);
  const computedEndDateTime = formatDateTimeInput(slotEndDate);

  const pushToast = (type: ToastType, text: string, sub?: string) => {
    const id = Date.now() + Math.floor(Math.random() * 10_000);
    setToasts((prev) => [...prev, { id, type, text, sub }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3500);
  };

  const closeToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const clearLoadedInspection = () => {
    setFormValues({});
  };

  const handleDataCenterChange = (dataCenterId: string) => {
    const fallback = shiftDefaultSlots.MORNING_SHIFT[0];
    setSelectedDataCenterId(dataCenterId);
    setInspectionShift("MORNING_SHIFT");
    setSelectedSlots(fallback ? [fallback] : []);
    clearLoadedInspection();
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    const firstAllowed = shiftDefaultSlots[inspectionShift as keyof typeof shiftDefaultSlots]?.[0];
    setSelectedSlots(firstAllowed ? [firstAllowed] : []);
    clearLoadedInspection();
  };

  const moveInspectionDate = (dayOffset: number) => {
    if (!selectedDate) return;
    const nextDate = new Date(`${selectedDate}T12:00:00`);
    nextDate.setDate(nextDate.getDate() + dayOffset);
    handleDateChange(formatDateInput(nextDate));
  };

  const handleShiftChange = (shift: string) => {
    setInspectionShift(shift);
    const allowed = shiftDefaultSlots[shift as keyof typeof shiftDefaultSlots] ?? [];
    const nextSlot = allowed.find((slot) => !inspectedSlots.includes(slot)) ?? allowed[0] ?? "";
    clearLoadedInspection();
    setSelectedSlots(nextSlot ? [nextSlot] : []);

  };

  const toggleSlot = (slot: string) => {
    if (inspectedSlots.includes(slot)) {
      pushToast("warning", "ช่วงเวลานี้มีการบันทึกผลตรวจแล้ว ไม่สามารถบันทึกซ้ำได้", "กรุณาเลือกช่วงเวลาอื่นในเวรเดียวกัน");
      return;
    }
    if (slot === activeTimeSlot) return;
    clearLoadedInspection();
    setSelectedSlots([slot]);
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

  const doSubmit = async () => {
    if (!formRef.current) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData(formRef.current);
      formData.delete("timeSlots");
      if (activeTimeSlot) {
        formData.append("timeSlots", activeTimeSlot);
        formData.set("timeSlot", activeTimeSlot);
      }
      formData.set("durationMinutes", String(selectedDurationMinutes));
      formData.set("inspectionStartedAt", computedStartDateTime);
      formData.set("inspectionCompletedAt", computedEndDateTime);
      formData.set("checkDate", selectedDate);
      formData.set("shift", inspectionShift);
      formData.set("startTime", parseSlotStart(activeTimeSlot));
      formData.set("endTime", `${String(slotEndDate.getHours()).padStart(2, "0")}:${String(slotEndDate.getMinutes()).padStart(2, "0")}`);

      const result = await createDailyInspectionAction(formData);
      if (!result?.ok) {
        if (result?.code === "DUPLICATE_SLOT") {
          pushToast("warning", result.message || "ช่วงเวลานี้มีการบันทึกผลตรวจแล้ว ไม่สามารถบันทึกซ้ำได้");
        } else {
          pushToast("error", result?.message || "บันทึกผลตรวจไม่สำเร็จ", "กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง");
        }
        await fetchCategories();
        return;
      }

      pushToast("success", "บันทึกผลตรวจสำเร็จ", `ช่วง ${activeSlotLabel} ระยะเวลา ${selectedDurationMinutes} นาที`);
      await fetchCategories();
    } catch (error) {
      console.error("Error submitting form:", error);
      pushToast("error", "บันทึกผลตรวจไม่สำเร็จ", "เกิดข้อผิดพลาดขณะบันทึกข้อมูล");
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestSaveConfirm = () => {
    if (isSubmitting) return;
    if (!selectedDataCenterId || !selectedDate || !inspectionShift || !activeTimeSlot || !selectedDurationMinutes) {
      pushToast(
        "warning",
        "กรุณาเลือกข้อมูลให้ครบ",
        "กรุณาเลือก Data Center, วันที่, เวร, ช่วงเวลา และระยะเวลาตรวจสอบให้ครบถ้วน"
      );
      return;
    }
    if (isActiveSlotInspected) {
      pushToast("warning", "ช่วงเวลานี้มีการบันทึกผลตรวจแล้ว ไม่สามารถบันทึกซ้ำได้");
      return;
    }
    setConfirmAction("save");
  };

  const handleReset = async () => {
    if (!selectedDataCenterId || !selectedDate) return;
    setConfirmAction("reset");
  };

  const doReset = async () => {
    setIsResetting(true);
    try {
      const formData = new FormData();
      formData.set("dataCenterId", selectedDataCenterId);
      formData.set("inspectionDate", selectedDate);
      formData.set("inspectionShift", inspectionShift);

      const result = await resetDailyInspectionAction(formData);
      if (!result.ok) throw new Error(result.error || "Reset failed");

      setFormValues({});
      pushToast("info", "รีเซ็ตข้อมูลแล้ว", "กรอกข้อมูลใหม่แล้วกดบันทึกอีกครั้ง");
      await fetchCategories();
    } catch (error) {
      console.error("Error resetting inspection:", error);
      pushToast("error", "รีเซ็ตไม่สำเร็จ", "เกิดข้อผิดพลาดขณะรีเซ็ตข้อมูล");
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

      const inspectionParams = new URLSearchParams({
        dataCenterId: selectedDataCenterId,
        date: selectedDate,
        inspectionShift
      });
      if (activeTimeSlot) {
        inspectionParams.set("timeSlot", activeTimeSlot);
      }

      const inspectionResponse = await fetch(`/api/daily-inspections?${inspectionParams.toString()}`);
      if (!inspectionResponse.ok) throw new Error("Failed to fetch daily inspection");
      const inspectionData = await inspectionResponse.json();
      const fallbackSlot = (shiftDefaultSlots[inspectionShift as keyof typeof shiftDefaultSlots] ?? [])[0] ?? "";

      setInspectedSlots(Array.isArray(inspectionData?.inspectedSlots) ? inspectionData.inspectedSlots : []);

      if (inspectionData?.inspection) {
        setFormValues(inspectionData.results || {});
        const inspectionSlot = inspectionData.inspection?.timeSlot;
        if (!activeTimeSlot && inspectionSlot) {
          setSelectedSlots([inspectionSlot]);
        }
      } else {
        setFormValues({});
        if (!activeTimeSlot && fallbackSlot) {
          setSelectedSlots([fallbackSlot]);
        }
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }, [selectedDataCenterId, selectedDate, activeTimeSlot, inspectionShift]);

  useEffect(() => {
    if (selectedDataCenterId && selectedDate) {
      fetchCategories();
    }
  }, [selectedDataCenterId, selectedDate, fetchCategories]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const returnTo = `/checklist/inspection?dataCenterId=${encodeURIComponent(selectedDataCenterId)}&date=${encodeURIComponent(selectedDate)}${activeTimeSlot ? `&timeSlot=${encodeURIComponent(activeTimeSlot)}` : ""}`;
  const progressPercent = totalSlotsInShift > 0 ? (inspectedSlotsInShift / totalSlotsInShift) * 100 : 0;
  const confirmationModal = confirmAction ? (
    <div className="inspection-modal-overlay" role="dialog" aria-modal="true">
      <div className="inspection-modal" tabIndex={-1}>
        <div className="inspection-modal-icon">
          {confirmAction === "save" ? <Save size={28} /> : <RotateCcw size={28} />}
        </div>
        <h3 className="inspection-modal-title">
          {confirmAction === "save" ? "ยืนยันก่อนบันทึก" : "ยืนยันก่อนรีเซ็ตฟอร์ม"}
        </h3>
        <p className="inspection-modal-desc">
          {confirmAction === "save" ? "ต้องการบันทึกผลการตรวจสอบใช่หรือไม่?" : "ต้องการล้างข้อมูลทั้งหมดใช่หรือไม่?"}
        </p>
        <div className="inspection-modal-summary">
          <div className="inspection-modal-row">
            <span className="inspection-modal-label">Data Center</span>
            <span className="inspection-modal-value">{dataCenters.find((dc) => dc.id === selectedDataCenterId)?.name || "-"}</span>
          </div>
          <div className="inspection-modal-row">
            <span className="inspection-modal-label">วันที่ตรวจสอบ</span>
            <span className="inspection-modal-value">{selectedDate || "-"}</span>
          </div>
          <div className="inspection-modal-row">
            <span className="inspection-modal-label">เวร/ช่วงเวลา</span>
            <span className="inspection-modal-value">{inspectionShiftOptions.find((item) => item.value === inspectionShift)?.label || "-"} · {activeSlotLabel}</span>
          </div>
          <div className="inspection-modal-row">
            <span className="inspection-modal-label">ระยะเวลา</span>
            <span className="inspection-modal-value">{selectedDurationMinutes} นาที</span>
          </div>
        </div>
        <div className="inspection-modal-actions">
          <button
            type="button"
            className="inspection-modal-btn inspection-modal-btn--cancel"
            onClick={() => setConfirmAction(null)}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            className="inspection-modal-btn inspection-modal-btn--confirm"
            disabled={isSubmitting || isResetting}
            onClick={async () => {
              const action = confirmAction;
              setConfirmAction(null);
              if (action === "save") {
                await doSubmit();
              } else {
                await doReset();
              }
            }}
          >
            {confirmAction === "save" ? "ยืนยันการบันทึก" : "ยืนยันการรีเซ็ต"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="inspection-form-wrap">
      <form ref={formRef} key={`${selectedDataCenterId}-${selectedDate}`}>
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="inspectorName" value={currentUserDisplayName} />
        <input type="hidden" name="inspectionStartedAt" value={computedStartDateTime} />
        <input type="hidden" name="inspectionCompletedAt" value={computedEndDateTime} />

        {/* ── Hero Section ── */}
        <section className="inspection-hero">
          <div className="inspection-hero-content">
            <div className="inspection-hero-header">
              <div className="inspection-hero-title-group">
                <div className="inspection-hero-icon">
                  <ClipboardCheck size={24} />
                </div>
                <div>
                  <h2 className="inspection-hero-title">ตรวจสอบห้อง Data Center</h2>
                  <p className="inspection-hero-desc">บันทึกผลการตรวจสอบประจำวัน</p>
                </div>
              </div>
              <div className="inspection-hero-actions">
                <button type="button" className="inspection-hero-btn inspection-hero-btn--refresh" onClick={async () => {
                  await fetchCategories();
                  pushToast("info", "รีเฟรชข้อมูลแล้ว!");
                }}>
                  <RefreshCw size={14} />
                  รีเฟรช
                </button>
                <button
                  type="button"
                  className="inspection-hero-btn inspection-hero-btn--reset"
                  onClick={handleReset}
                  disabled={isResetting || isSubmitting}
                >
                  <RotateCcw size={14} />
                  {isResetting ? "กำลังรีเซ็ต..." : "รีเซ็ต"}
                </button>
              </div>
            </div>

            {/* ── Filters ── */}
            <div className="inspection-filters">
              <div className="inspection-filter">
                <label><Building2 size={14} /> Data Center</label>
                <select name="dataCenterId" value={selectedDataCenterId} onChange={(e) => handleDataCenterChange(e.target.value)} required>
                  {dataCenters.map((dc) => (
                    <option key={dc.id} value={dc.id}>{dc.name}</option>
                  ))}
                </select>
              </div>
              <div className="inspection-filter inspection-filter--date">
                <label><Calendar size={14} /> วันที่ตรวจสอบ</label>
                <div className="inspection-date-control">
                  <button type="button" className="inspection-date-nav" onClick={() => moveInspectionDate(-1)} aria-label="Previous day">
                    ‹
                  </button>
                  <input type="date" name="inspectionDate" value={selectedDate} onChange={(e) => handleDateChange(e.target.value)} required />
                  <button type="button" className="inspection-date-nav" onClick={() => moveInspectionDate(1)} aria-label="Next day">
                    ›
                  </button>
                  <button type="button" className="inspection-date-today" onClick={() => handleDateChange(formatDateInput(new Date()))}>
                    วันนี้
                  </button>
                </div>
              </div>
              <div className="inspection-filter">
                <label><Clock size={14} /> เวรปฏิบัติงาน</label>
                <select name="inspectionShift" value={inspectionShift} onChange={(e) => handleShiftChange(e.target.value)} required>
                  {inspectionShiftOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="inspection-filter">
                <label><Clock size={14} /> ระยะเวลาที่ใช้ตรวจสอบ</label>
                <select
                  name="durationMinutes"
                  value={selectedDurationMinutes}
                  onChange={(e) => setSelectedDurationMinutes(Number(e.target.value))}
                  required
                >
                  {durationOptions.map((minutes) => (
                    <option key={minutes} value={minutes}>{minutes} นาที</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Time Slots ── */}
            <div className="inspection-slots-section">
              <div className="inspection-slots-label">
                <Clock size={14} />
                <span>เลือกช่วงเวลาตรวจสอบ</span>
              </div>
              <div className="inspection-slots">
                {ALL_TIME_SLOTS.filter((slot) => {
                  return allowedSlots.length > 0 ? allowedSlots.includes(slot.value as any) : true;
                }).map((slot) => {
                  const checked = selectedSlots.includes(slot.value);
                  const disabled = inspectedSlots.includes(slot.value);
                  return (
                    <button
                      key={slot.value}
                      type="button"
                      className={`inspection-slot${checked ? " inspection-slot--active" : ""}${disabled ? " inspection-slot--disabled" : ""}`}
                      onClick={() => toggleSlot(slot.value)}
                      disabled={disabled}
                      title={disabled ? "ช่วงเวลานี้มีการบันทึกผลตรวจแล้ว" : slot.label}
                    >
                      <input type="checkbox" name="timeSlots" value={slot.value} checked={checked} onChange={() => {}} />
                      {slot.label}
                      {disabled ? <span className="inspection-slot-badge">ตรวจแล้ว</span> : null}
                    </button>
                  );
                })}
              </div>
              {selectedSlots.length > 0 && !isActiveSlotInspected && (
                <div className="inspection-slot-info">
                  <Check size={14} />
                  เลือกช่วง {activeSlotLabel} · เวลาเริ่มตรวจ {parseSlotStart(activeTimeSlot)} · เวลาสิ้นสุดตรวจ {String(slotEndDate.getHours()).padStart(2, "0")}:{String(slotEndDate.getMinutes()).padStart(2, "0")}
                </div>
              )}
              {isActiveSlotInspected && (
                <div className="inspection-slot-info inspection-slot-info--warn">
                  <AlertTriangle size={14} />
                  ช่วงเวลานี้ตรวจแล้ว ไม่สามารถบันทึกซ้ำได้
                </div>
              )}
              {selectedSlots.length === 0 && (
                <div className="inspection-slot-info inspection-slot-info--warn">
                  <AlertTriangle size={14} />
                  กรุณาเลือกช่วงเวลาอย่างน้อย 1 ช่วงก่อนบันทึก
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Progress Bar ── */}
        <div className="inspection-progress-bar">
          <div className="inspection-progress-track">
            <div className="inspection-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="inspection-progress-text">{inspectedSlotsInShift} / {totalSlotsInShift} รายการ</span>
        </div>

        {/* ── Unified Checklist Table ── */}
        <section className="inspection-checklist-board">
          <div className="inspection-table-wrap inspection-table-wrap--single">
            <table className="inspection-table inspection-table--single">
              <colgroup>
                <col className="inspection-col-detail" />
                <col className="inspection-col-status" />
                <col className="inspection-col-metric" />
                <col className="inspection-col-metric" />
                <col className="inspection-col-note" />
              </colgroup>
              <thead>
                <tr>
                  <th><FileText size={13} /> รายละเอียด</th>
                  <th><Search size={13} /> สถานะ</th>
                  <th><Thermometer size={13} /> อุณหภูมิ (°C)</th>
                  <th><Droplets size={13} /> ความชื้น (%)</th>
                  <th><FileText size={13} /> หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <Fragment key={category.id}>
                    <tr className="inspection-category-row">
                      <td colSpan={5}>
                        <div className="inspection-category-inline">
                          <span className="inspection-category-inline-icon">🔍</span>
                          <span className="inspection-category-inline-name">{category.name}</span>
                          <span className="inspection-category-inline-count">{category.items.length} รายการ</span>
                        </div>
                      </td>
                    </tr>
                    {category.items.map((item) => {
                      const existing = formValues[item.id] || { status: "", temperature: "", humidity: "", note: "" };
                      return (
                        <tr key={item.id}>
                          <td><span className="inspection-item-name">{item.name}</span></td>
                          <td className="inspection-status-cell">
                            <div className="inspection-status-group">
                              <label className="inspection-radio inspection-radio--normal">
                                <input
                                  type="radio"
                                  name={`status_${item.id}`}
                                  value="NORMAL"
                                  checked={existing.status === "NORMAL"}
                                  onChange={(e) => handleInputChange(item.id, "status", e.target.value)}
                                  required
                                />
                                <span>ปกติ</span>
                              </label>
                              <label className="inspection-radio inspection-radio--abnormal">
                                <input
                                  type="radio"
                                  name={`status_${item.id}`}
                                  value="ABNORMAL"
                                  checked={existing.status === "ABNORMAL"}
                                  onChange={(e) => handleInputChange(item.id, "status", e.target.value)}
                                />
                                <span>ผิดปกติ</span>
                              </label>
                            </div>
                          </td>
                          <td>
                            {item.requiresTemperature ? (
                              <input
                                type="number" step="0.1"
                                name={`temperature_${item.id}`}
                                value={existing.temperature}
                                onChange={(e) => handleInputChange(item.id, "temperature", e.target.value)}
                                placeholder="-"
                                className="inspection-input"
                              />
                            ) : (
                              <span className="inspection-dash">-</span>
                            )}
                          </td>
                          <td>
                            {item.requiresHumidity ? (
                              <input
                                type="number" step="0.1"
                                name={`humidity_${item.id}`}
                                value={existing.humidity}
                                onChange={(e) => handleInputChange(item.id, "humidity", e.target.value)}
                                placeholder="-"
                                className="inspection-input"
                              />
                            ) : (
                              <span className="inspection-dash">-</span>
                            )}
                          </td>
                          <td>
                            <input
                              type="text" name={`note_${item.id}`}
                              value={existing.note}
                              onChange={(e) => handleInputChange(item.id, "note", e.target.value)}
                              placeholder="-"
                              className="inspection-input"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Submit Button ── */}
        <div className="inspection-submit-wrap">
          <button
            type="button"
            className="inspection-submit"
            disabled={isSubmitting || isActiveSlotInspected}
            onClick={requestSaveConfirm}
          >
            <Save size={18} />
            {isActiveSlotInspected ? "ช่วงเวลานี้ตรวจแล้ว" : isSubmitting ? "กำลังบันทึก..." : "บันทึกผลการตรวจสอบ"}
          </button>
        </div>
      </form>

      {/* ── Confirmation Modal ── */}
      {isMounted && confirmationModal ? createPortal(confirmationModal, document.body) : null}

      {/* ── Toast Notifications ── */}
      <div className="inspection-toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`inspection-notification inspection-notification--${toast.type === "warning" ? "danger" : toast.type}`}
          >
            <div className="inspection-notification-icon">
              {toast.type === "success" ? <Check size={20} /> : toast.type === "info" ? <RefreshCw size={20} /> : toast.type === "warning" ? <AlertTriangle size={20} /> : <X size={20} />}
            </div>
            <div className="inspection-notification-content">
              <div className="inspection-notification-text">{toast.text}</div>
              {toast.sub ? <div className="inspection-notification-sub">{toast.sub}</div> : null}
            </div>
            <button className="inspection-notification-close" onClick={() => closeToast(toast.id)}><X size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
