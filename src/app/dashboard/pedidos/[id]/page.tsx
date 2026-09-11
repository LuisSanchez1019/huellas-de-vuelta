import { Suspense } from "react";
import OrderDetailView from "@/components/placas/OrderDetailView";

export default async function PedidoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const justCreated = sp.created === "1";
  return (
    <Suspense fallback={null}>
      <OrderDetailView orderId={id} justCreated={justCreated} />
    </Suspense>
  );
}
