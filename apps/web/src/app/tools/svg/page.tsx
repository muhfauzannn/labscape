import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { SvgTools } from "@/features/svg-tools/svg-tools";
import "@/features/svg-tools/svg-tools.css";

export const metadata: Metadata = {
  title: "SVG tools",
  description: "Interactive machines to explore, with a voice AI tutor.",
};

export default function SvgToolsPage() {
  return (
    <>
      <SiteHeader closeOnMount />
      <main id="main-content" className="svg-tools iso" data-theme="light">
        <Suspense>
          <SvgTools />
        </Suspense>
      </main>
    </>
  );
}
