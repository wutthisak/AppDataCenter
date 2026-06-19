"use client";

export function PrintButton({ label = "พิมพ์ / บันทึก PDF" }: { label?: string }) {
  return <button className="button" type="button" onClick={() => window.print()}>{label}</button>;
}
