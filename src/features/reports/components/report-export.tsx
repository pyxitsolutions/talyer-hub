"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { Button } from "@/components/ui/button";
import { exportToExcel } from "@/lib/excel/export";
import { formatCurrency, formatCurrencyForPDF } from "@/lib/utils";
import type { ReportData } from "../actions";

interface ReportExportProps {
  report: ReportData | null;
  filename: string;
  allowExcelExport?: boolean;
}

function formatSummaryValue(value: string | number, forPdf = false): string {
  if (typeof value === "number") {
    return value >= 100
      ? forPdf
        ? formatCurrencyForPDF(value)
        : formatCurrency(value)
      : String(value);
  }
  return value;
}

export function ReportExport({
  report,
  filename,
  allowExcelExport = true,
}: ReportExportProps) {
  if (!report) return null;

  const handleExcelExport = () => {
    const summaryRows = Object.entries(report.summary).map(([key, value]) => ({
      Metric: key,
      Value: formatSummaryValue(value),
    }));

    exportToExcel(
      [...report.rows, ...summaryRows] as Record<string, unknown>[],
      report.title,
      filename
    );
  };

  const handlePdfExport = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(report.title, 14, 20);

    if (report.rows.length > 0) {
      const headers = Object.keys(report.rows[0]);
      const body = report.rows.map((row) =>
        headers.map((h) => {
          const val = row[h];
          return typeof val === "number" && h.toLowerCase().includes("amount")
            ? formatCurrencyForPDF(val)
            : String(val);
        })
      );

      autoTable(doc, {
        startY: 30,
        head: [headers],
        body,
        theme: "striped",
        headStyles: { fillColor: [30, 30, 30] },
      });
    }

    let y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY
      ? (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15
      : 40;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 14, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    for (const [key, value] of Object.entries(report.summary)) {
      doc.text(`${key}: ${formatSummaryValue(value, true)}`, 14, y);
      y += 6;
    }

    doc.save(`${filename}.pdf`);
  };

  return (
    <div className="flex gap-2">
      {allowExcelExport ? (
        <Button variant="outline" size="sm" onClick={handleExcelExport}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export Excel
        </Button>
      ) : null}
      <Button variant="outline" size="sm" onClick={handlePdfExport}>
        <FileText className="mr-2 h-4 w-4" />
        Export PDF
      </Button>
    </div>
  );
}
