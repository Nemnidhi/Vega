import { renderToBuffer } from "@react-pdf/renderer";
import { LATE_COMING_FREE_PER_MONTH, type SalaryMonthDetail } from "@/lib/salary/calculator";
import { PayslipDocument, derivePayslipLines } from "@/lib/salary/payslip-pdf";

// Same timezone the rest of the app is built around (lib/attendance/date.ts) - this app's VPS
// runs in UTC, so an unqualified toLocaleString() here would print a "generated on" timestamp
// 5.5 hours off from what the dashboard shows for the same moment.
const TIME_ZONE = "Asia/Kolkata";

// Shared by both the admin payslip route (any employee) and the self-service one (caller's own
// data only) so the document and the HTTP response around it are built identically either way.
export async function buildPayslipPdf(detail: SalaryMonthDetail, monthKey: string) {
  if (detail.baseSalary === null) {
    throw new Error("Base salary is not set for this employee yet.");
  }

  const { lateFreeCount, lateDeductedCount, deductions } = derivePayslipLines(detail);

  const monthLabel = new Date(`${monthKey}-01T00:00:00.000Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
  const generatedOnLabel = new Date().toLocaleString("en-US", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const pdf = await renderToBuffer(
    PayslipDocument({
      employeeName: detail.user.fullName,
      employeeRole: detail.user.role,
      monthLabel,
      generatedOnLabel,
      baseSalary: detail.baseSalary,
      dailyRate: detail.dailyRate,
      presentDays: detail.workedDays,
      lateComingDays: detail.lateComingDays,
      lateFreeAllowance: LATE_COMING_FREE_PER_MONTH,
      lateFreeCount,
      lateDeductedCount,
      paidLeaveDays: detail.paidLeaveDays,
      deductions,
      totalDeductionAmount: detail.deductionAmount,
      netPay: detail.netPay,
    }),
  );

  const safeName = detail.user.fullName.replace(/[^a-z0-9]+/gi, "_").slice(0, 60);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}-${monthKey}-payslip.pdf"`,
      "Content-Length": String(pdf.length),
    },
  });
}
