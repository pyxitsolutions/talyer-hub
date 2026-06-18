import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import type { Shop, RepairEstimate, Invoice, JobOrder, JobOrderPart, Customer, Vehicle } from "@/types/database";
import { formatCurrencyForPDF, formatDate } from "@/lib/utils";

interface PDFHeaderOptions {
  shop: Shop;
  title: string;
  documentNumber: string;
  date: string;
  verificationCode?: string;
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function addHeader(doc: jsPDF, options: PDFHeaderOptions) {
  const { shop, title, documentNumber, date, verificationCode } = options;

  let textX = 14;
  let headerTop = 20;

  if (shop.logo_url) {
    const logoDataUrl = await loadImageAsDataUrl(shop.logo_url);
    if (logoDataUrl) {
      const imageFormat = logoDataUrl.includes("image/jpeg")
        ? "JPEG"
        : logoDataUrl.includes("image/webp")
          ? "WEBP"
          : "PNG";
      doc.addImage(logoDataUrl, imageFormat, 14, 10, 18, 18);
      textX = 36;
      headerTop = 18;
    }
  }

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(shop.shop_name, textX, headerTop);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(shop.address || "", textX, headerTop + 6);
  doc.text(
    `Tel: ${shop.contact_number || "N/A"} | Email: ${shop.email || "N/A"}`,
    textX,
    headerTop + 11
  );

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 42);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`No: ${documentNumber}`, 14, 50);
  doc.text(`Date: ${formatDate(date)}`, 14, 56);

  if (verificationCode) {
    const qrDataUrl = await QRCode.toDataURL(
      `${process.env.NEXT_PUBLIC_APP_URL}/verify/${verificationCode}`,
      { width: 60 }
    );
    doc.addImage(qrDataUrl, "PNG", 170, 10, 25, 25);
    doc.setFontSize(7);
    doc.text("Scan to verify", 172, 38);
  }
}

function addSignatureArea(doc: jsPDF, y: number) {
  doc.setFontSize(9);
  doc.line(14, y, 80, y);
  doc.text("Customer Signature", 14, y + 5);
  doc.line(120, y, 186, y);
  doc.text("Authorized Signature", 120, y + 5);
}

export async function generateEstimatePDF(
  shop: Shop,
  estimate: RepairEstimate & { repair_estimate_items?: { part_name: string; quantity: number; unit_price: number; total_price: number }[] }
) {
  const doc = new jsPDF();
  await addHeader(doc, {
    shop,
    title: "REPAIR ESTIMATE",
    documentNumber: estimate.estimate_number,
    date: estimate.estimate_date,
  });

  let y = 65;
  doc.setFontSize(10);
  doc.text(`Customer: ${estimate.customers?.full_name || "N/A"}`, 14, y);
  y += 6;
  doc.text(`Vehicle: ${estimate.vehicles?.brand || ""} ${estimate.vehicles?.model || ""} (${estimate.vehicles?.plate_number || ""})`, 14, y);
  y += 6;
  doc.text(`Chassis: ${estimate.chassis_number || "N/A"} | Engine: ${estimate.engine_number || "N/A"}`, 14, y);
  y += 10;

  doc.text("Problem:", 14, y);
  y += 5;
  doc.setFontSize(9);
  const problemLines = doc.splitTextToSize(estimate.problem_description || "N/A", 180);
  doc.text(problemLines, 14, y);
  y += problemLines.length * 5 + 5;

  doc.setFontSize(10);
  doc.text("Repair Description:", 14, y);
  y += 5;
  doc.setFontSize(9);
  const repairLines = doc.splitTextToSize(estimate.repair_description || "N/A", 180);
  doc.text(repairLines, 14, y);
  y += repairLines.length * 5 + 5;

  if (estimate.repair_estimate_items?.length) {
    autoTable(doc, {
      startY: y,
      head: [["Part Name", "Qty", "Unit Price", "Total"]],
      body: estimate.repair_estimate_items.map((item) => [
        item.part_name,
        Math.round(item.quantity).toString(),
        formatCurrencyForPDF(item.unit_price),
        formatCurrencyForPDF(item.total_price),
      ]),
      theme: "striped",
      headStyles: { fillColor: [30, 30, 30] },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  doc.setFontSize(10);
  doc.text(`Labor Cost: ${formatCurrencyForPDF(estimate.labor_cost)}`, 140, y);
  y += 6;
  doc.text(`Parts Cost: ${formatCurrencyForPDF(estimate.parts_cost)}`, 140, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`Total: ${formatCurrencyForPDF(estimate.total_cost)}`, 140, y);
  doc.setFont("helvetica", "normal");

  addSignatureArea(doc, 260);
  return doc;
}

export async function generateInvoicePDF(
  shop: Shop,
  invoice: Invoice & { invoice_items?: { part_name: string; quantity: number; unit_price: number; total_price: number }[] }
) {
  const doc = new jsPDF();
  await addHeader(doc, {
    shop,
    title: "BILLING INVOICE",
    documentNumber: invoice.invoice_number,
    date: invoice.invoice_date,
    verificationCode: invoice.verification_code,
  });

  let y = 65;
  doc.setFontSize(10);
  doc.text(`Customer: ${invoice.customers?.full_name || "N/A"}`, 14, y);
  y += 6;
  doc.text(`Vehicle: ${invoice.vehicles?.brand || ""} ${invoice.vehicles?.model || ""} (${invoice.vehicles?.plate_number || ""})`, 14, y);
  y += 6;
  doc.text(`Payment Status: ${invoice.payment_status.toUpperCase()}`, 14, y);
  y += 6;
  if (invoice.payment_method) {
    doc.text(
      `Payment Method: ${invoice.payment_method.replace(/_/g, " ")}`,
      14,
      y
    );
    y += 6;
  }
  if (invoice.payment_reference) {
    doc.text(`Reference: ${invoice.payment_reference}`, 14, y);
    y += 6;
  }
  if (invoice.payer_account_name) {
    doc.text(`Payer Account: ${invoice.payer_account_name}`, 14, y);
    y += 6;
  }
  y += 4;

  if (invoice.invoice_items?.length) {
    autoTable(doc, {
      startY: y,
      head: [["Part/Service", "Qty", "Unit Price", "Total"]],
      body: invoice.invoice_items.map((item) => [
        item.part_name,
        Math.round(item.quantity).toString(),
        formatCurrencyForPDF(item.unit_price),
        formatCurrencyForPDF(item.total_price),
      ]),
      theme: "striped",
      headStyles: { fillColor: [30, 30, 30] },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  doc.text(`Labor: ${formatCurrencyForPDF(invoice.labor_cost)}`, 140, y);
  y += 6;
  doc.text(`Parts: ${formatCurrencyForPDF(invoice.parts_cost)}`, 140, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`Total: ${formatCurrencyForPDF(invoice.total_amount)}`, 140, y);
  doc.setFont("helvetica", "normal");
  y += 6;
  doc.text(`Paid: ${formatCurrencyForPDF(invoice.amount_paid)}`, 140, y);

  addSignatureArea(doc, 260);
  return doc;
}

export async function generateJobOrderPDF(
  shop: Shop,
  jobOrder: JobOrder & {
    customers?: Customer;
    vehicles?: Vehicle;
    job_order_parts?: JobOrderPart[];
    repair_estimates?: Pick<RepairEstimate, "estimate_number" | "labor_cost"> | null;
  }
) {
  const doc = new jsPDF();
  const documentDate =
    jobOrder.date_started?.split("T")[0] ??
    jobOrder.created_at.split("T")[0];

  await addHeader(doc, {
    shop,
    title: "JOB ORDER",
    documentNumber: jobOrder.job_order_number,
    date: documentDate,
  });

  let y = 65;
  doc.setFontSize(10);
  doc.text(`Customer: ${jobOrder.customers?.full_name || "N/A"}`, 14, y);
  y += 6;
  doc.text(
    `Vehicle: ${jobOrder.vehicles?.brand || ""} ${jobOrder.vehicles?.model || ""} (${jobOrder.vehicles?.plate_number || ""})`,
    14,
    y
  );
  y += 6;
  doc.text(
    `Chassis: ${jobOrder.vehicles?.chassis_number || "N/A"} | Engine: ${jobOrder.vehicles?.engine_number || "N/A"}`,
    14,
    y
  );
  y += 6;
  doc.text(`Technician: ${jobOrder.assigned_technician || "—"}`, 14, y);
  y += 6;
  doc.text(`Status: ${jobOrder.status.toUpperCase()}`, 14, y);
  y += 6;
  doc.text(
    `Date Started: ${jobOrder.date_started ? formatDate(jobOrder.date_started) : "—"} | Date Completed: ${jobOrder.date_completed ? formatDate(jobOrder.date_completed) : "—"}`,
    14,
    y
  );
  if (jobOrder.repair_estimates?.estimate_number) {
    y += 6;
    doc.text(`Source Estimate: ${jobOrder.repair_estimates.estimate_number}`, 14, y);
  }
  y += 10;

  doc.text("Repair Description:", 14, y);
  y += 5;
  doc.setFontSize(9);
  const repairLines = doc.splitTextToSize(jobOrder.repair_description || "N/A", 180);
  doc.text(repairLines, 14, y);
  y += repairLines.length * 5 + 5;

  if (jobOrder.job_order_parts?.length) {
    doc.setFontSize(10);
    autoTable(doc, {
      startY: y,
      head: [["Part Name", "Qty", "Unit Price", "Total"]],
      body: jobOrder.job_order_parts.map((item) => [
        item.part_name,
        Math.round(item.quantity).toString(),
        formatCurrencyForPDF(item.unit_price),
        formatCurrencyForPDF(item.total_price),
      ]),
      theme: "striped",
      headStyles: { fillColor: [30, 30, 30] },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  const partsTotal = (jobOrder.job_order_parts ?? []).reduce(
    (sum, part) => sum + Number(part.total_price),
    0
  );
  const laborCost = Number(
    jobOrder.labor_cost ?? jobOrder.repair_estimates?.labor_cost ?? 0
  );
  const jobOrderTotal = partsTotal + laborCost;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  let totalY = y;
  if (laborCost > 0) {
    doc.text(`Labor: ${formatCurrencyForPDF(laborCost)}`, 140, totalY);
    totalY += 6;
  }
  doc.text(`Parts Total: ${formatCurrencyForPDF(partsTotal)}`, 140, totalY);
  totalY += 6;
  doc.text(`Total: ${formatCurrencyForPDF(jobOrderTotal)}`, 140, totalY);
  doc.setFont("helvetica", "normal");

  addSignatureArea(doc, 260);
  return doc;
}

export function downloadPDF(doc: jsPDF, filename: string) {
  doc.save(filename);
}
