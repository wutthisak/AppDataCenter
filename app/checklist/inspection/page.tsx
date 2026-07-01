import { AppShell } from "@/components/AppShell";
import { InspectionForm } from "@/components/InspectionForm";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { inspectionTimeSlotOrder } from "@/lib/inspection-shifts";

export default async function DailyInspectionPage(
  props: {
    searchParams: Promise<{ dataCenterId?: string; date?: string; saved?: string; timeSlot?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const dataCenters = await prisma.dataCenter.findMany({
    where: { active: true },
    orderBy: { displayOrder: "asc" }
  });

  const selectedDataCenterId = searchParams.dataCenterId || dataCenters[0]?.id || "";
  const selectedDate = searchParams.date || new Date().toISOString().split('T')[0];
  const selectedTimeSlot = inspectionTimeSlotOrder.includes(searchParams.timeSlot as any)
    ? (searchParams.timeSlot as (typeof inspectionTimeSlotOrder)[number])
    : "";

  const categories = await prisma.checklistCategory.findMany({
    where: { 
      active: true,
      dataCenterId: selectedDataCenterId
    },
    orderBy: { displayOrder: "asc" },
    include: {
      items: {
        where: { active: true },
        orderBy: { displayOrder: "asc" }
      }
    }
  });

  let existingInspection = null;
  let existingResults: Record<string, { status: string; temperature: string; humidity: string; note: string }> = {};

  if (selectedDataCenterId && selectedDate) {
    existingInspection = await prisma.dailyInspection.findFirst({
      where: {
        dataCenterId: selectedDataCenterId,
        inspectionDate: new Date(selectedDate),
        ...(selectedTimeSlot ? { timeSlot: selectedTimeSlot } : {})
      },
      orderBy: { timeSlot: "desc" },
      include: {
        results: {
          include: {
            checklistItem: true
          }
        }
      }
    });

    if (existingInspection) {
      existingResults = existingInspection.results.reduce((acc, result) => {
        acc[result.checklistItemId] = {
          status: result.status,
          temperature: result.temperature?.toString() || "",
          humidity: result.humidity?.toString() || "",
          note: result.note || ""
        };
        return acc;
      }, {} as Record<string, { status: string; temperature: string; humidity: string; note: string }>);
    }
  }

  return (
    <AppShell title="ตรวจสอบห้อง Data Center" subtitle="บันทึกผลการตรวจสอบรายวัน" variant="daily-report" hideTopbar>
      <InspectionForm
        initialDataCenters={dataCenters}
        initialSelectedDataCenterId={selectedDataCenterId}
        initialSelectedDate={selectedDate}
        initialSelectedTimeSlot={selectedTimeSlot}
        initialCategories={categories}
        initialExistingInspection={existingInspection}
        initialExistingResults={existingResults}
        currentUserDisplayName={user.displayName}
      />
    </AppShell>
  );
}
