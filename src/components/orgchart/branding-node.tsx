"use client";

import type { Node, NodeProps } from "@xyflow/react";

/** Jednoduchý typ – žiadne dáta. */
type BrandingNodeData = Record<string, never>;

/** Uzol zobrazujúci logo a názov „Artifex Systems Slovakia“ podľa brandu (vždy nad rootom). */
export function BrandingNode(_props: NodeProps<Node<BrandingNodeData, "branding">>) {
  return (
    <div className="nodrag nopan flex flex-col items-center justify-center gap-1">
      <img
        src="/artifex-logo.png"
        alt="Artifex"
        className="h-10 w-auto object-contain"
        width={120}
        height={40}
      />
      <p
        className="text-center text-xs font-semibold tracking-wide"
        style={{ color: "var(--artifex-navy)", fontFamily: "var(--font-display)" }}
      >
        Artifex Systems Slovakia
      </p>
    </div>
  );
}
