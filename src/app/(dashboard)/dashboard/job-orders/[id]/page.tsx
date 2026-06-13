import { JobOrderView } from "@/features/job-orders/components/job-order-view";

interface JobOrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function JobOrderDetailPage({
  params,
}: JobOrderDetailPageProps) {
  const { id } = await params;

  return <JobOrderView jobOrderId={id} />;
}
