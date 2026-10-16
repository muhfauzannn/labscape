import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { DesignSystem } from "@/features/design-system/components/design-system";
export const metadata: Metadata = { title: "Design system" };
export default function Page() {
  return (
    <>
      <SiteHeader />
      <DesignSystem />
    </>
  );
}
