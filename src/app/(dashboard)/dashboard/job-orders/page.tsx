import { Suspense } from "react";

import { JobOrderTable } from "@/features/job-orders/components/job-order-table";

export default function JobOrdersPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading job orders...</p>}>
      <JobOrderTable />
    </Suspense>
  );
}
