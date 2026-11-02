import { Suspense } from "react";
import type { Metadata } from "next";
import { RequestDetail } from "@/components/request-detail";

export const metadata: Metadata = {
  title: "Request",
};

export default function RequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-muted">Loading request…</p>}>
      <LoadedRequest params={params} />
    </Suspense>
  );
}

async function LoadedRequest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequestDetail id={id} />;
}
