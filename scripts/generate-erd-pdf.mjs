import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "docs");
const outPath = join(outDir, "TalyerHub-ERD.pdf");

mkdirSync(outDir, { recursive: true });

const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
const pageWidth = doc.internal.pageSize.getWidth();
const margin = 14;
let y = margin;

function addPageIfNeeded(extra = 20) {
  if (y + extra > doc.internal.pageSize.getHeight() - margin) {
    doc.addPage();
    y = margin;
  }
}

function heading(text, size = 14) {
  addPageIfNeeded(12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(size);
  doc.text(text, margin, y);
  y += size * 0.45 + 4;
}

function paragraph(text, size = 9) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
  addPageIfNeeded(lines.length * 4 + 4);
  doc.text(lines, margin, y);
  y += lines.length * 4 + 3;
}

function bullet(items, size = 9) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  for (const item of items) {
    const lines = doc.splitTextToSize(`• ${item}`, pageWidth - margin * 2 - 4);
    addPageIfNeeded(lines.length * 4 + 2);
    doc.text(lines, margin + 2, y);
    y += lines.length * 4 + 1;
  }
  y += 2;
}

function entityTable(name, columns) {
  addPageIfNeeded(24);
  autoTable(doc, {
    startY: y,
    head: [[`${name}`, "Type", "Constraints"]],
    body: columns.map(([col, type, constraints = ""]) => [col, type, constraints]),
    margin: { left: margin, right: margin },
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 28 },
      2: { cellWidth: "auto" },
    },
  });
  y = doc.lastAutoTable.finalY + 6;
}

// Cover
doc.setFont("helvetica", "bold");
doc.setFontSize(22);
doc.text("TalyerHub", margin, 40);
doc.setFontSize(14);
doc.setFont("helvetica", "normal");
doc.text("Entity Relationship Diagram (ERD)", margin, 50);
doc.setFontSize(10);
doc.text(`Generated: ${new Date().toISOString().split("T")[0]}`, margin, 58);
doc.text("Multi-tenant auto care shop management system", margin, 66);

doc.setDrawColor(100, 116, 139);
doc.line(margin, 72, pageWidth - margin, 72);

y = 82;
heading("Overview", 12);
paragraph(
  "Each shop is an isolated tenant. Almost every business table includes shop_id and is protected by Supabase Row Level Security (RLS). auth.users (Supabase Auth) links to profiles."
);

heading("Core Repair Workflow", 11);
bullet([
  "units_received → repair_estimates → job_orders → invoices → sales_records",
  "repair_estimate_items / job_order_parts / invoice_items link to inventory_items",
  "inventory_transactions records stock_in, stock_out, adjustment",
]);

heading("Key Relationships", 11);
bullet([
  "shops 1—* customers, vehicles, estimates, job orders, invoices, inventory, expenses, sales",
  "customers 1—* vehicles",
  "repair_estimates 1—0..1 job_orders (via estimate_id)",
  "job_orders 1—0..1 invoices (via job_order_id)",
  "invoices 1—* sales_records",
  "One active estimate per vehicle: unique (shop_id, customer_id, vehicle_id) where status in (draft, approved)",
]);

doc.addPage();
y = margin;
heading("Enums", 12);

autoTable(doc, {
  startY: y,
  head: [["Enum", "Values"]],
  body: [
    ["estimate_status", "draft, approved, rejected, released"],
    ["job_order_status", "pending, ongoing, completed, released"],
    ["payment_status", "unpaid, partial, paid"],
    ["payment_method", "cash, card, bank_transfer, check, other"],
    ["inventory_transaction_type", "stock_in, stock_out, adjustment"],
    ["unit_category", "pms, minor_repair, general_repair, body_repair_paint"],
    [
      "expense_category",
      "shop_expenses, food, kitchen_supplies, electricity, water, internet, rent, salary_expenses, weekly_salary, monthly_salary, yearly_salary",
    ],
    ["sale_type", "parts, materials, labor"],
  ],
  margin: { left: margin, right: margin },
  styles: { fontSize: 7, cellPadding: 1.5 },
  headStyles: { fillColor: [30, 41, 59] },
  columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: "auto" } },
});
y = doc.lastAutoTable.finalY + 8;

heading("Entity Definitions", 12);

entityTable("shops (tenant root)", [
  ["id", "UUID", "PK"],
  ["shop_name", "TEXT", "NOT NULL"],
  ["owner_name", "TEXT", "NOT NULL"],
  ["contact_number", "TEXT", ""],
  ["email", "TEXT", ""],
  ["address", "TEXT", ""],
  ["logo_url", "TEXT", ""],
  ["created_at", "TIMESTAMPTZ", "NOT NULL"],
  ["updated_at", "TIMESTAMPTZ", "NOT NULL"],
]);

entityTable("profiles", [
  ["id", "UUID", "PK, FK → auth.users.id"],
  ["shop_id", "UUID", "FK → shops.id"],
  ["full_name", "TEXT", "NOT NULL"],
  ["email", "TEXT", "NOT NULL"],
  ["avatar_url", "TEXT", ""],
  ["phone", "TEXT", ""],
  ["is_active", "BOOLEAN", "NOT NULL DEFAULT true"],
  ["created_at", "TIMESTAMPTZ", "NOT NULL"],
  ["updated_at", "TIMESTAMPTZ", "NOT NULL"],
]);

entityTable("roles", [
  ["id", "UUID", "PK"],
  ["name", "TEXT", "NOT NULL UNIQUE (owner, service_advisor, technician, cashier)"],
  ["description", "TEXT", ""],
  ["created_at", "TIMESTAMPTZ", "NOT NULL"],
  ["updated_at", "TIMESTAMPTZ", "NOT NULL"],
]);

entityTable("user_roles", [
  ["id", "UUID", "PK"],
  ["user_id", "UUID", "FK → profiles.id"],
  ["role_id", "UUID", "FK → roles.id"],
  ["shop_id", "UUID", "FK → shops.id"],
  ["created_at", "TIMESTAMPTZ", "NOT NULL"],
  ["updated_at", "TIMESTAMPTZ", "NOT NULL"],
  ["", "", "UNIQUE (user_id, role_id, shop_id)"],
]);

entityTable("customers", [
  ["id", "UUID", "PK"],
  ["shop_id", "UUID", "FK → shops.id"],
  ["customer_number", "TEXT", "NOT NULL"],
  ["full_name", "TEXT", "NOT NULL"],
  ["contact_number", "TEXT", ""],
  ["address", "TEXT", ""],
  ["email", "TEXT", ""],
  ["created_at", "TIMESTAMPTZ", "NOT NULL"],
  ["updated_at", "TIMESTAMPTZ", "NOT NULL"],
  ["", "", "UNIQUE (shop_id, customer_number)"],
]);

entityTable("vehicles", [
  ["id", "UUID", "PK"],
  ["shop_id", "UUID", "FK → shops.id"],
  ["customer_id", "UUID", "FK → customers.id"],
  ["plate_number", "TEXT", "NOT NULL"],
  ["brand", "TEXT", "NOT NULL"],
  ["unit", "TEXT", ""],
  ["model", "TEXT", "NOT NULL"],
  ["year_model", "INTEGER", ""],
  ["chassis_number", "TEXT", ""],
  ["engine_number", "TEXT", ""],
  ["color", "TEXT", ""],
  ["created_at", "TIMESTAMPTZ", "NOT NULL"],
  ["updated_at", "TIMESTAMPTZ", "NOT NULL"],
  ["", "", "UNIQUE (shop_id, plate_number)"],
]);

entityTable("repair_estimates", [
  ["id", "UUID", "PK"],
  ["shop_id", "UUID", "FK → shops.id"],
  ["estimate_number", "TEXT", "NOT NULL"],
  ["estimate_date", "DATE", "NOT NULL"],
  ["customer_id", "UUID", "FK → customers.id"],
  ["vehicle_id", "UUID", "FK → vehicles.id"],
  ["chassis_number", "TEXT", ""],
  ["engine_number", "TEXT", ""],
  ["problem_description", "TEXT", ""],
  ["repair_description", "TEXT", ""],
  ["recommendation", "TEXT", ""],
  ["technician_name", "TEXT", ""],
  ["labor_cost", "DECIMAL(12,2)", "NOT NULL DEFAULT 0"],
  ["parts_cost", "DECIMAL(12,2)", "NOT NULL DEFAULT 0"],
  ["total_cost", "DECIMAL(12,2)", "NOT NULL DEFAULT 0"],
  ["status", "estimate_status", "NOT NULL DEFAULT draft"],
  ["created_at", "TIMESTAMPTZ", "NOT NULL"],
  ["updated_at", "TIMESTAMPTZ", "NOT NULL"],
  ["", "", "UNIQUE (shop_id, estimate_number)"],
]);

entityTable("repair_estimate_items", [
  ["id", "UUID", "PK"],
  ["shop_id", "UUID", "FK → shops.id"],
  ["estimate_id", "UUID", "FK → repair_estimates.id"],
  ["inventory_item_id", "UUID", "FK → inventory_items.id"],
  ["part_name", "TEXT", "NOT NULL"],
  ["quantity", "DECIMAL(10,2)", "NOT NULL DEFAULT 1"],
  ["unit_price", "DECIMAL(12,2)", "NOT NULL DEFAULT 0"],
  ["total_price", "DECIMAL(12,2)", "NOT NULL DEFAULT 0"],
  ["created_at", "TIMESTAMPTZ", "NOT NULL"],
  ["updated_at", "TIMESTAMPTZ", "NOT NULL"],
]);

entityTable("job_orders", [
  ["id", "UUID", "PK"],
  ["shop_id", "UUID", "FK → shops.id"],
  ["job_order_number", "TEXT", "NOT NULL"],
  ["estimate_id", "UUID", "FK → repair_estimates.id (nullable)"],
  ["customer_id", "UUID", "FK → customers.id"],
  ["vehicle_id", "UUID", "FK → vehicles.id"],
  ["assigned_technician", "TEXT", ""],
  ["date_started", "DATE", ""],
  ["date_completed", "DATE", ""],
  ["status", "job_order_status", "NOT NULL DEFAULT pending"],
  ["repair_description", "TEXT", ""],
  ["created_at", "TIMESTAMPTZ", "NOT NULL"],
  ["updated_at", "TIMESTAMPTZ", "NOT NULL"],
  ["", "", "UNIQUE (shop_id, job_order_number)"],
]);

entityTable("job_order_parts", [
  ["id", "UUID", "PK"],
  ["shop_id", "UUID", "FK → shops.id"],
  ["job_order_id", "UUID", "FK → job_orders.id"],
  ["inventory_item_id", "UUID", "FK → inventory_items.id"],
  ["part_name", "TEXT", "NOT NULL"],
  ["quantity", "DECIMAL(10,2)", "NOT NULL DEFAULT 1"],
  ["unit_price", "DECIMAL(12,2)", "NOT NULL DEFAULT 0"],
  ["total_price", "DECIMAL(12,2)", "NOT NULL DEFAULT 0"],
  ["created_at", "TIMESTAMPTZ", "NOT NULL"],
  ["updated_at", "TIMESTAMPTZ", "NOT NULL"],
]);

entityTable("invoices", [
  ["id", "UUID", "PK"],
  ["shop_id", "UUID", "FK → shops.id"],
  ["invoice_number", "TEXT", "NOT NULL"],
  ["invoice_date", "DATE", "NOT NULL"],
  ["customer_id", "UUID", "FK → customers.id"],
  ["vehicle_id", "UUID", "FK → vehicles.id"],
  ["job_order_id", "UUID", "FK → job_orders.id (nullable)"],
  ["chassis_number", "TEXT", ""],
  ["engine_number", "TEXT", ""],
  ["repair_description", "TEXT", ""],
  ["recommendation", "TEXT", ""],
  ["parts_used", "TEXT", ""],
  ["labor_cost", "DECIMAL(12,2)", "NOT NULL DEFAULT 0"],
  ["parts_cost", "DECIMAL(12,2)", "NOT NULL DEFAULT 0"],
  ["total_amount", "DECIMAL(12,2)", "NOT NULL DEFAULT 0"],
  ["amount_paid", "DECIMAL(12,2)", "NOT NULL DEFAULT 0"],
  ["payment_method", "payment_method", ""],
  ["payment_status", "payment_status", "NOT NULL DEFAULT unpaid"],
  ["technician_name", "TEXT", ""],
  ["verification_code", "TEXT", ""],
  ["created_at", "TIMESTAMPTZ", "NOT NULL"],
  ["updated_at", "TIMESTAMPTZ", "NOT NULL"],
  ["", "", "UNIQUE (shop_id, invoice_number)"],
]);

entityTable("invoice_items", [
  ["id", "UUID", "PK"],
  ["shop_id", "UUID", "FK → shops.id"],
  ["invoice_id", "UUID", "FK → invoices.id"],
  ["inventory_item_id", "UUID", "FK → inventory_items.id"],
  ["part_name", "TEXT", "NOT NULL"],
  ["quantity", "DECIMAL(10,2)", "NOT NULL DEFAULT 1"],
  ["unit_price", "DECIMAL(12,2)", "NOT NULL DEFAULT 0"],
  ["total_price", "DECIMAL(12,2)", "NOT NULL DEFAULT 0"],
  ["created_at", "TIMESTAMPTZ", "NOT NULL"],
  ["updated_at", "TIMESTAMPTZ", "NOT NULL"],
]);

entityTable("inventory_items", [
  ["id", "UUID", "PK"],
  ["shop_id", "UUID", "FK → shops.id"],
  ["part_number", "TEXT", "NOT NULL"],
  ["part_name", "TEXT", "NOT NULL"],
  ["category", "TEXT", ""],
  ["quantity", "DECIMAL(10,2)", "NOT NULL DEFAULT 0"],
  ["cost_price", "DECIMAL(12,2)", "NOT NULL DEFAULT 0"],
  ["selling_price", "DECIMAL(12,2)", "NOT NULL DEFAULT 0"],
  ["reorder_level", "DECIMAL(10,2)", "NOT NULL DEFAULT 5"],
  ["supplier", "TEXT", ""],
  ["created_at", "TIMESTAMPTZ", "NOT NULL"],
  ["updated_at", "TIMESTAMPTZ", "NOT NULL"],
  ["", "", "UNIQUE (shop_id, part_number)"],
]);

entityTable("inventory_transactions", [
  ["id", "UUID", "PK"],
  ["shop_id", "UUID", "FK → shops.id"],
  ["inventory_item_id", "UUID", "FK → inventory_items.id"],
  ["transaction_type", "inventory_transaction_type", "NOT NULL"],
  ["quantity", "DECIMAL(10,2)", "NOT NULL"],
  ["reference_type", "TEXT", ""],
  ["reference_id", "UUID", ""],
  ["notes", "TEXT", ""],
  ["created_by", "UUID", "FK → profiles.id"],
  ["created_at", "TIMESTAMPTZ", "NOT NULL"],
  ["updated_at", "TIMESTAMPTZ", "NOT NULL"],
]);

entityTable("units_received", [
  ["id", "UUID", "PK"],
  ["shop_id", "UUID", "FK → shops.id"],
  ["received_date", "DATE", "NOT NULL"],
  ["category", "unit_category", "NOT NULL"],
  ["customer_id", "UUID", "FK → customers.id (nullable)"],
  ["vehicle_id", "UUID", "FK → vehicles.id (nullable)"],
  ["job_order_id", "UUID", "FK → job_orders.id (nullable)"],
  ["notes", "TEXT", ""],
  ["created_at", "TIMESTAMPTZ", "NOT NULL"],
  ["updated_at", "TIMESTAMPTZ", "NOT NULL"],
]);

entityTable("expenses", [
  ["id", "UUID", "PK"],
  ["shop_id", "UUID", "FK → shops.id"],
  ["expense_date", "DATE", "NOT NULL"],
  ["category", "expense_category", "NOT NULL"],
  ["description", "TEXT", "NOT NULL"],
  ["amount", "DECIMAL(12,2)", "NOT NULL"],
  ["created_by", "UUID", "FK → profiles.id"],
  ["created_at", "TIMESTAMPTZ", "NOT NULL"],
  ["updated_at", "TIMESTAMPTZ", "NOT NULL"],
]);

entityTable("sales_records", [
  ["id", "UUID", "PK"],
  ["shop_id", "UUID", "FK → shops.id"],
  ["sale_date", "DATE", "NOT NULL"],
  ["sale_type", "sale_type", "NOT NULL"],
  ["description", "TEXT", ""],
  ["amount", "DECIMAL(12,2)", "NOT NULL"],
  ["invoice_id", "UUID", "FK → invoices.id (nullable)"],
  ["created_at", "TIMESTAMPTZ", "NOT NULL"],
  ["updated_at", "TIMESTAMPTZ", "NOT NULL"],
]);

doc.addPage();
y = margin;
heading("Foreign Key Map", 12);

autoTable(doc, {
  startY: y,
  head: [["From Table", "Column", "To Table"]],
  body: [
    ["profiles", "shop_id", "shops"],
    ["profiles", "id", "auth.users"],
    ["user_roles", "user_id", "profiles"],
    ["user_roles", "role_id", "roles"],
    ["user_roles", "shop_id", "shops"],
    ["customers", "shop_id", "shops"],
    ["vehicles", "shop_id", "shops"],
    ["vehicles", "customer_id", "customers"],
    ["repair_estimates", "shop_id", "shops"],
    ["repair_estimates", "customer_id", "customers"],
    ["repair_estimates", "vehicle_id", "vehicles"],
    ["repair_estimate_items", "estimate_id", "repair_estimates"],
    ["repair_estimate_items", "inventory_item_id", "inventory_items"],
    ["job_orders", "estimate_id", "repair_estimates"],
    ["job_orders", "customer_id", "customers"],
    ["job_orders", "vehicle_id", "vehicles"],
    ["job_order_parts", "job_order_id", "job_orders"],
    ["job_order_parts", "inventory_item_id", "inventory_items"],
    ["invoices", "job_order_id", "job_orders"],
    ["invoices", "customer_id", "customers"],
    ["invoices", "vehicle_id", "vehicles"],
    ["invoice_items", "invoice_id", "invoices"],
    ["invoice_items", "inventory_item_id", "inventory_items"],
    ["inventory_transactions", "inventory_item_id", "inventory_items"],
    ["inventory_transactions", "created_by", "profiles"],
    ["units_received", "customer_id", "customers"],
    ["units_received", "vehicle_id", "vehicles"],
    ["units_received", "job_order_id", "job_orders"],
    ["expenses", "created_by", "profiles"],
    ["sales_records", "invoice_id", "invoices"],
  ],
  margin: { left: margin, right: margin },
  styles: { fontSize: 7, cellPadding: 1.5 },
  headStyles: { fillColor: [30, 41, 59] },
  columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 32 }, 2: { cellWidth: "auto" } },
});

const totalPages = doc.getNumberOfPages();
for (let i = 1; i <= totalPages; i++) {
  doc.setPage(i);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`TalyerHub ERD — Page ${i} of ${totalPages}`, margin, doc.internal.pageSize.getHeight() - 8);
}

const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
writeFileSync(outPath, pdfBuffer);
console.log(`ERD PDF written to: ${outPath}`);
