import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { getSession } from "@/features/auth/server/auth";
import { toolCatalog } from "@/lib/tool-catalog";
import { SvgTools } from "@/features/svg-tools/svg-tools";
import "@/features/svg-tools/svg-tools.css";

export const metadata: Metadata = {
  title: "Interactive tools",
  description: "Interactive machines to explore, with a voice AI tutor.",
};
export const instant = false;

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string | string[] }>;
}) {
  await connection();
  const token = (await cookies()).get("labai_session")?.value;
  if (!getSession(token)) {
    const requestedTool = (await searchParams).tool;
    const tool = typeof requestedTool === "string" && toolCatalog.some((item) => item.id === requestedTool)
      ? requestedTool
      : null;
    const destination = tool ? `/start?tool=${encodeURIComponent(tool)}` : "/start";
    redirect(`/login?next=${encodeURIComponent(destination)}`);
  }

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
