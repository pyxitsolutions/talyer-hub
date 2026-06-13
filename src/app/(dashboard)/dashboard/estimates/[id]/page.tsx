import { EstimateView } from "@/features/estimates/components/estimate-view";

interface EstimateDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function EstimateDetailPage({
  params,
}: EstimateDetailPageProps) {
  const { id } = await params;

  return <EstimateView estimateId={id} />;
}
