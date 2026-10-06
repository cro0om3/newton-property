"use client";

import { Suspense } from "react";
import { RecordList } from "@/components/record-list";

export default function ClientsPage() {
  return (
    <Suspense>
      <RecordList kind="inquiry" />
    </Suspense>
  );
}
