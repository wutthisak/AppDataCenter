"use client";

import { useState } from "react";
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

export function DataCentersTable({ initialDataCenters }: DataCentersTableProps) {
  const [dataCenters, setDataCenters] = useState<DataCenter[]>(initialDataCenters);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDataCenter, setEditingDataCenter] = useState<DataCenter | undefined>();

  const handleEdit = (dc: DataCenter) => {
    setEditingDataCenter(dc);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingDataCenter(undefined);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingDataCenter(undefined);
  };

  const handleSave = async (data: { name: string; location: string; description: string }) => {
    try {
      const url = editingDataCenter ? `/api/datacenters/${editingDataCenter.id}` : "/api/datacenters";
      const method = editingDataCenter ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error("Failed to save");

      // Refresh data
      const dataCentersResponse = await fetch("/api/datacenters");
      const updatedData = await dataCentersResponse.json();
      setDataCenters(updatedData);
      setIsModalOpen(false);
      setEditingDataCenter(undefined);
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const response = await fetch(`/api/datacenters/${id}/toggle`, {
        method: "POST"
      });

      if (!response.ok) throw new Error("Failed to toggle");

      // Refresh data
      const dataCentersResponse = await fetch("/api/datacenters");
      const updatedData = await dataCentersResponse.json();
      setDataCenters(updatedData);
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการเปลี่ยนสถานะ");
    }
  };

  return (
    <>
      <div className="grid">
        <section className="card">
          <div className="toolbar">
            <div>
              <h2>รายการ Data Center</h2>
            </div>
            <button className="button" onClick={handleAdd}>
              + เพิ่ม Data Center ใหม่
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 90 }}>ลำดับ</th>
                  <th>ชื่อ</th>
                  <th>ที่ตั้ง</th>
                  <th>คำอธิบาย</th>
                  <th>สถานะ</th>
                  <th style={{ width: 200 }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {dataCenters.map((dc) => (
                  <tr key={dc.id}>
                    <td>{dc.displayOrder}</td>
                    <td>{dc.name}</td>
                    <td>{dc.location ?? "-"}</td>
                    <td>{dc.description ?? "-"}</td>
                    <td><span className={`badge ${dc.active ? "" : "locked"}`}>{dc.active ? "ACTIVE" : "INACTIVE"}</span></td>
                    <td>
                      <div className="action-stack">
                        <button className="button secondary" onClick={() => handleEdit(dc)}>
                          แก้ไข
                        </button>
                        <button 
                          className={`button ${dc.active ? "danger" : "secondary"}`}
                          onClick={() => handleToggle(dc.id)}
                        >
                          {dc.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {isModalOpen && (
        <DataCenterModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          dataCenter={editingDataCenter}
          onSave={handleSave}
        />
      )}
    </>
  );
}
