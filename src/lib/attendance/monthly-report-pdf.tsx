// One employee's full month of attendance as a downloadable PDF - the same data as the "Full
// report" CSV button (attendance-admin-desk.tsx's exportMonthlyDetail), scoped to a single
// employee so it can be handed to that person directly rather than needing the whole team's CSV.
//
// Kept separate from lib/prospecting/report-template.tsx (the sales audit report) rather than
// reusing it - that template is a heavy, sales-specific document; this is a plain tabular ops
// report and sharing a component between them would couple two things that change independently.

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

// Nemnidhi's brand teal, matching report-template.tsx, so this reads as the same company's
// document rather than a generic table dropped in a different palette.
const BRAND_TEAL = "#0891b2";
const BORDER = "#d1d5db";
const MUTED = "#6b7280";

export type MonthlyReportRow = {
  dateKey: string;
  dayLabel: string;
  statusLabel: string;
  checkIn: string;
  checkOut: string;
  workTime: string;
  breakMinutes: number;
};

export type MonthlyReportSummary = {
  presentDays: number;
  lateComingDays: number;
  absentDays: number;
  halfDays: number;
  totalMarkedDays: number;
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#111827" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  brand: { fontSize: 14, fontWeight: 700, color: BRAND_TEAL },
  generated: { fontSize: 8, color: MUTED, textAlign: "right" },
  title: { fontSize: 16, fontWeight: 700, marginTop: 12 },
  subtitle: { fontSize: 10, color: MUTED, marginTop: 2, marginBottom: 12 },
  summaryRow: { flexDirection: "row", gap: 14, marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  summaryItem: { flexDirection: "column" },
  summaryValue: { fontSize: 14, fontWeight: 700 },
  summaryLabel: { fontSize: 8, color: MUTED, marginTop: 1 },
  table: { borderWidth: 1, borderColor: BORDER },
  tHeadRow: { flexDirection: "row", backgroundColor: "#f3f4f6", borderBottomWidth: 1, borderBottomColor: BORDER },
  tRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER },
  tRowLast: { flexDirection: "row" },
  tHeadCell: { padding: 5, fontSize: 8, fontWeight: 700, color: "#374151" },
  tCell: { padding: 5, fontSize: 8.5 },
  colDate: { width: "16%" },
  colStatus: { width: "20%" },
  colTime: { width: "16%" },
  colWork: { width: "16%" },
  colBreak: { width: "16%" },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, fontSize: 7.5, color: MUTED, textAlign: "center" },
});

function statusColor(statusLabel: string) {
  if (statusLabel === "Absent") return "#b91c1c";
  if (statusLabel === "Late Coming") return "#b45309";
  if (statusLabel === "Present") return "#15803d";
  return "#374151";
}

export function MonthlyAttendanceReportDocument({
  employeeName,
  employeeRole,
  monthLabel,
  generatedOnLabel,
  rows,
  summary,
}: {
  employeeName: string;
  employeeRole: string;
  monthLabel: string;
  generatedOnLabel: string;
  rows: MonthlyReportRow[];
  summary: MonthlyReportSummary;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>Nemnidhi</Text>
          <Text style={styles.generated}>Generated {generatedOnLabel}</Text>
        </View>
        <Text style={styles.title}>{employeeName}</Text>
        <Text style={styles.subtitle}>
          {employeeRole.replaceAll("_", " ")} - Attendance report for {monthLabel}
        </Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: "#15803d" }]}>{summary.presentDays}</Text>
            <Text style={styles.summaryLabel}>Present</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: "#b45309" }]}>{summary.lateComingDays}</Text>
            <Text style={styles.summaryLabel}>Late Coming</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: "#b91c1c" }]}>{summary.absentDays}</Text>
            <Text style={styles.summaryLabel}>Absent</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.halfDays}</Text>
            <Text style={styles.summaryLabel}>Half Day</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.totalMarkedDays}</Text>
            <Text style={styles.summaryLabel}>Total Marked</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tHeadRow} fixed>
            <Text style={[styles.tHeadCell, styles.colDate]}>Date</Text>
            <Text style={[styles.tHeadCell, styles.colStatus]}>Status</Text>
            <Text style={[styles.tHeadCell, styles.colTime]}>Check-in</Text>
            <Text style={[styles.tHeadCell, styles.colTime]}>Check-out</Text>
            <Text style={[styles.tHeadCell, styles.colWork]}>Work time</Text>
            <Text style={[styles.tHeadCell, styles.colBreak]}>Break</Text>
          </View>
          {rows.map((row, index) => (
            <View key={row.dateKey} style={index === rows.length - 1 ? styles.tRowLast : styles.tRow} wrap={false}>
              <Text style={[styles.tCell, styles.colDate]}>{row.dayLabel}</Text>
              <Text style={[styles.tCell, styles.colStatus, { color: statusColor(row.statusLabel) }]}>{row.statusLabel}</Text>
              <Text style={[styles.tCell, styles.colTime]}>{row.checkIn}</Text>
              <Text style={[styles.tCell, styles.colTime]}>{row.checkOut}</Text>
              <Text style={[styles.tCell, styles.colWork]}>{row.workTime}</Text>
              <Text style={[styles.tCell, styles.colBreak]}>{row.breakMinutes > 0 ? `${row.breakMinutes}m` : "--"}</Text>
            </View>
          ))}
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages} - Nemnidhi Attendance Report`}
          fixed
        />
      </Page>
    </Document>
  );
}
