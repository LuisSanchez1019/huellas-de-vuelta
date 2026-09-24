"use client";

import { use } from "react";
import MedicalRecordView from "@/components/vet/MedicalRecordView";

export default function FichaPage({ params }: { params: Promise<{ grantId: string }> }) {
  const { grantId } = use(params);
  return <MedicalRecordView grantId={grantId} />;
}
