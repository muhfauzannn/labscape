import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SvgTools } from "@/features/svg-tools/svg-tools";
import "@/features/svg-tools/svg-tools.css";

export const metadata: Metadata = {
  title: "SVG tools",
  description: "Five interactive SVG tools.",
};

export default function SvgToolsPage() {
  return (
    <>
      <SiteHeader closeOnMount />
      <main id="main-content" className="svg-tools iso" data-theme="light">
        <SvgTools />
      </main>
    </>
  );
}
