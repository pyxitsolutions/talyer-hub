import { InvoiceView } from "@/features/invoices/components/invoice-view";

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({
  params,
}: InvoiceDetailPageProps) {
  const { id } = await params;

  return <InvoiceView invoiceId={id} />;
}
