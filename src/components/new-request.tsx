"use client";

import { useRouter } from "next/navigation";
import { RequestForm, type RequestFormValues } from "@/components/request-form";
import type { RequestDto } from "@/domain/types";
import { clientApi } from "@/lib/client-api";

export function NewRequest() {
  const router = useRouter();

  async function onSubmit(values: RequestFormValues) {
    const created = await clientApi<RequestDto>("/api/requests", {
      method: "POST",
      body: JSON.stringify(values),
    });
    router.push(`/requests/${created.id}`);
  }

  return <RequestForm submitLabel="Raise request" onSubmit={onSubmit} />;
}
