import { SiteHeader } from "@/components/layout/site-header";
import { Hero } from "@/features/marketing/components/hero";
export default function Home() {
  return (
    <>
      <SiteHeader overlay />
      <main id="main-content">
        <Hero />
      </main>
    </>
  );
}
