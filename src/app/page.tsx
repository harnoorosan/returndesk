import { Suspense } from "react";
import { Desk } from "@/components/desk";

export default function HomePage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading the desk…</p>}>
      <Desk />
    </Suspense>
  );
}
