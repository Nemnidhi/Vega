// One employee's payslip for a month - a summary document (base salary, itemized deductions,
// net pay) rather than the full daily attendance log, which already has its own separate PDF
// (lib/attendance/monthly-report-pdf.tsx). Kept as its own template for the same reason that one
// is separate from the sales audit report: different document, changes independently.

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { LATE_COMING_DEDUCTION_FRACTION, type SalaryMonthDetail } from "@/lib/salary/calculator";

const BRAND_TEAL = "#0891b2";
const BORDER = "#d1d5db";
const MUTED = "#6b7280";
const RED = "#b91c1c";
const GREEN = "#15803d";

export type PayslipDeductionLine = {
  label: string;
  days: number;
  amount: number;
};

export type PayslipDocumentProps = {
  employeeName: string;
  employeeRole: string;
  monthLabel: string;
  generatedOnLabel: string;
  baseSalary: number;
  dailyRate: number;
  presentDays: number;
  lateComingDays: number;
  lateFreeAllowance: number;
  lateFreeCount: number;
  lateDeductedCount: number;
  paidLeaveDays: number;
  deductions: PayslipDeductionLine[];
  totalDeductionAmount: number;
  netPay: number;
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#111827" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  brand: { fontSize: 14, fontWeight: 700, color: BRAND_TEAL },
  generated: { fontSize: 8, color: MUTED, textAlign: "right" },
  title: { fontSize: 16, fontWeight: 700, marginTop: 12 },
  subtitle: { fontSize: 10, color: MUTED, marginTop: 2, marginBottom: 16 },
  netPayBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
  },
  netPayLabel: { fontSize: 11, fontWeight: 700, color: "#065f46" },
  netPayValue: { fontSize: 20, fontWeight: 700, color: GREEN },
  sectionTitle: { fontSize: 10, fontWeight: 700, marginBottom: 6, marginTop: 4 },
  summaryRow: { flexDirection: "row", gap: 14, marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  summaryItem: { flexDirection: "column" },
  summaryValue: { fontSize: 13, fontWeight: 700 },
  summaryLabel: { fontSize: 8, color: MUTED, marginTop: 1 },
  table: { borderWidth: 1, borderColor: BORDER, marginBottom: 16 },
  tHeadRow: { flexDirection: "row", backgroundColor: "#f3f4f6", borderBottomWidth: 1, borderBottomColor: BORDER },
  tRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER },
  tRowLast: { flexDirection: "row" },
  tHeadCell: { padding: 5, fontSize: 8, fontWeight: 700, color: "#374151" },
  tCell: { padding: 5, fontSize: 8.5 },
  colLabel: { width: "55%" },
  colDays: { width: "20%", textAlign: "right" },
  colAmount: { width: "25%", textAlign: "right" },
  totalRow: { flexDirection: "row", backgroundColor: "#f9fafb" },
  totalLabel: { padding: 5, fontSize: 8.5, fontWeight: 700, width: "75%", textAlign: "right" },
  totalAmount: { padding: 5, fontSize: 8.5, fontWeight: 700, width: "25%", textAlign: "right", color: RED },
  note: { fontSize: 7.5, color: MUTED, marginTop: 2 },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, fontSize: 7.5, color: MUTED, textAlign: "center" },
});

function currency(amount: number) {
  return `Rs ${Math.round(amount).toLocaleString("en-IN")}`;
}

// Turns the calculator's day-by-day output into the itemized lines a payslip actually shows -
// one line per deduction reason with a days x rate amount, rather than the raw per-day list.
export function derivePayslipLines(detail: SalaryMonthDetail) {
  const lateDays = detail.days.filter((day) => day.category === "late_coming");
  const lateFreeCount = lateDays.filter((day) => day.deductionDays === 0).length;
  const lateDeductedCount = lateDays.length - lateFreeCount;

  const deductions: PayslipDeductionLine[] = [];
  if (lateDeductedCount > 0) {
    deductions.push({
      label: "Late coming (over monthly free allowance)",
      days: lateDeductedCount,
      amount: Math.round(lateDeductedCount * LATE_COMING_DEDUCTION_FRACTION * detail.dailyRate),
    });
  }
  if (detail.halfDays > 0) {
    deductions.push({ label: "Half day", days: detail.halfDays, amount: Math.round(detail.halfDays * 0.5 * detail.dailyRate) });
  }
  if (detail.unpaidLeaveDays > 0) {
    deductions.push({ label: "Unpaid leave", days: detail.unpaidLeaveDays, amount: Math.round(detail.unpaidLeaveDays * detail.dailyRate) });
  }
  if (detail.absentDays > 0) {
    deductions.push({ label: "Absent (no approved leave)", days: detail.absentDays, amount: Math.round(detail.absentDays * detail.dailyRate) });
  }

  return { lateFreeCount, lateDeductedCount, deductions };
}

export function PayslipDocument({
  employeeName,
  employeeRole,
  monthLabel,
  generatedOnLabel,
  baseSalary,
  dailyRate,
  presentDays,
  lateComingDays,
  lateFreeAllowance,
  lateFreeCount,
  lateDeductedCount,
  paidLeaveDays,
  deductions,
  totalDeductionAmount,
  netPay,
}: PayslipDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>Nemnidhi</Text>
          <Text style={styles.generated}>Generated {generatedOnLabel}</Text>
        </View>
        <Text style={styles.title}>{employeeName}</Text>
        <Text style={styles.subtitle}>
          {employeeRole.replaceAll("_", " ")} - Payslip for {monthLabel}
        </Text>

        <View style={styles.netPayBox}>
          <Text style={styles.netPayLabel}>Net Pay</Text>
          <Text style={styles.netPayValue}>{currency(netPay)}</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{presentDays}</Text>
            <Text style={styles.summaryLabel}>Present</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{lateComingDays}</Text>
            <Text style={styles.summaryLabel}>
              Late ({lateFreeCount} free, {lateDeductedCount} deducted)
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{paidLeaveDays}</Text>
            <Text style={styles.summaryLabel}>Paid leave</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{currency(dailyRate)}</Text>
            <Text style={styles.summaryLabel}>Per-day rate</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Earnings &amp; Deductions</Text>
        <View style={styles.table}>
          <View style={styles.tHeadRow}>
            <Text style={[styles.tHeadCell, styles.colLabel]}>Description</Text>
            <Text style={[styles.tHeadCell, styles.colDays]}>Days</Text>
            <Text style={[styles.tHeadCell, styles.colAmount]}>Amount</Text>
          </View>
          <View style={styles.tRow}>
            <Text style={[styles.tCell, styles.colLabel]}>Base salary</Text>
            <Text style={[styles.tCell, styles.colDays]}>--</Text>
            <Text style={[styles.tCell, styles.colAmount]}>{currency(baseSalary)}</Text>
          </View>
          {deductions.length === 0 ? (
            <View style={styles.tRowLast}>
              <Text style={[styles.tCell, styles.colLabel]}>No deductions this month</Text>
              <Text style={[styles.tCell, styles.colDays]}>--</Text>
              <Text style={[styles.tCell, styles.colAmount]}>Rs 0</Text>
            </View>
          ) : (
            deductions.map((line, index) => (
              <View key={line.label} style={index === deductions.length - 1 ? styles.tRowLast : styles.tRow}>
                <Text style={[styles.tCell, styles.colLabel, { color: RED }]}>Less: {line.label}</Text>
                <Text style={[styles.tCell, styles.colDays]}>{line.days}</Text>
                <Text style={[styles.tCell, styles.colAmount, { color: RED }]}>-{currency(line.amount)}</Text>
              </View>
            ))
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total deducted</Text>
            <Text style={styles.totalAmount}>-{currency(totalDeductionAmount)}</Text>
          </View>
        </View>
        <Text style={styles.note}>
          Late coming: first {lateFreeAllowance} per month are free ({lateFreeCount} used); every late mark after
          that deducts 25% of that day&apos;s rate ({lateDeductedCount} deducted this month). Paid leave (casual,
          sick, planned) does not affect pay - only unpaid leave and unexcused absence do.
        </Text>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages} - Nemnidhi Payslip`}
          fixed
        />
      </Page>
    </Document>
  );
}
