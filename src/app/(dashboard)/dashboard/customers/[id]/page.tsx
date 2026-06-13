import { CustomerDetail } from "@/features/customers/components/customer-detail";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params;

  return <CustomerDetail customerId={id} />;
}
