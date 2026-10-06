"use client";

import { Suspense } from "react";
import { RecordList } from "@/components/record-list";

export default function PropertiesPage() {
  return (
    <Suspense>
      <RecordList kind="listing" />
    </Suspense>
  );
}
