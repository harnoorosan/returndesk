import type { Metadata } from "next";
import { NewRequest } from "@/components/new-request";

export const metadata: Metadata = {
  title: "New request",
};

export default function NewRequestPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Raise a request</h1>
        <p className="mt-2 text-muted">
          Record who the customer is, which item came back, and why.
        </p>
      </div>
      <div className="rounded-2xl border border-line bg-card p-4 sm:p-6">
        <NewRequest />
      </div>
    </div>
  );
}
