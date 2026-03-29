"use client";

import { use } from "react";
import SagaStatus from "@/components/SagaStatus";
import Link from "next/link";

const AUTH_TOKEN = "hedgehog-dev-token";

export default function ExecutionPage({
  params,
}: {
  params: Promise<{ sagaId: string }>;
}) {
  const { sagaId } = use(params);

  return (
    <div className="mx-auto max-w-[720px] px-6 py-8">
      <div className="mb-6">
        <Link
          href="/"
          className="text-[12px] text-[#6366F1] hover:text-[#4F46E5] transition-colors"
        >
          &larr; Back to Dashboard
        </Link>
        <h1 className="mt-2 text-[22px] font-bold text-[#0F172A] tracking-[-0.02em]">
          Hedge Execution
        </h1>
        <p className="text-[11px] text-[#94A3B8] font-mono mt-1">
          {sagaId}
        </p>
      </div>

      <SagaStatus sagaId={sagaId} authToken={AUTH_TOKEN} />
    </div>
  );
}
