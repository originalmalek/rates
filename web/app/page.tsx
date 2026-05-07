import { Suspense } from "react";
import Dashboard from "./dashboard";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-4 py-10 text-zinc-600 text-sm">
          Loading…
        </div>
      }
    >
      <Dashboard />
    </Suspense>
  );
}
