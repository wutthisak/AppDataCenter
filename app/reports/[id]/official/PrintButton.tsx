"use client";

export function PrintButton() {
  return (
    <button
      className="official-btn-print"
      onClick={() => window.print()}
      style={{ cursor: "pointer" }}
    >
      🖨 พิมพ์ / บันทึก PDF
    </button>
  );
}

export function BackButton({ reportId }: { reportId: string }) {
  function handleBack() {
    window.location.href = `/reports`;
  }
  return (
    <button className="official-btn-back" onClick={handleBack} style={{ cursor: "pointer" }}>
      ← กลับ
    </button>
  );
}
