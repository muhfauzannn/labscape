"use client";

import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import Link from "next/link";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Boxes,
  ChevronDown,
  Cog,
  Keyboard,
  Layers2,
  LayoutGrid,
  type LucideIcon,
  Menu,
  Mic,
  Microscope,
  Monitor,
  Printer,
  Rocket,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { toolCatalog, toolHref, type ToolId } from "@/lib/tool-catalog";
import styles from "./site-header.module.css";

type NavigationCardProps = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const toolIcons: Record<ToolId, LucideIcon> = {
  computer: Monitor,
  rocket: Rocket,
  engine: Cog,
  "microscope-lab": Microscope,
  typewriter: Keyboard,
  printer: Printer,
};

const toolLinks: NavigationCardProps[] = toolCatalog.map((tool) => ({
  title: tool.label,
  description: tool.blurb,
  href: toolHref(tool.id),
  icon: toolIcons[tool.id],
}));

const learnLinks: NavigationCardProps[] = [
  {
    title: "Explore",
    description: "Pull machines apart and inspect every part.",
    href: "/#learn-explore",
    icon: Boxes,
  },
  {
    title: "Experiment",
    description: "Change the controls and watch the model respond.",
    href: "/#learn-experiment",
    icon: SlidersHorizontal,
  },
  {
    title: "Ask AI",
    description: "Ask out loud and get an answer about what you see.",
    href: "/#learn-ask",
    icon: AudioLines,
  },
];

const resourceLinks: NavigationCardProps[] = [
  {
    title: "All tools",
    description: "Open the lab and pick a machine.",
    href: "/start",
    icon: LayoutGrid,
  },
  {
    title: "Design system",
    description: "Tokens, components, and examples.",
    href: "/design-system",
    icon: Layers2,
  },
];

function Brand() {
  return (
    <Link href="/" className={styles.brand} aria-label="Labai home">
      <span className={styles.mark}>
        <Layers2 aria-hidden="true" size={21} strokeWidth={2.5} />
      </span>
      labai<span className={styles.dot}>.</span>
    </Link>
  );
}

function MenuCard({ title, description, href, icon: IconComponent }: NavigationCardProps) {
  return (
    <NavigationMenu.Link asChild>
      <Link href={href} className={styles.menuCard}>
        <span className={styles.menuCardIcon}>
          <IconComponent aria-hidden="true" size={17} strokeWidth={1.9} />
        </span>
        <span className={styles.menuCardCopy}>
          <span className={styles.menuCardTitle}>{title}</span>
          <span className={styles.menuCardDescription}>{description}</span>
        </span>
        <ArrowUpRight className={styles.menuCardArrow} aria-hidden="true" size={14} />
      </Link>
    </NavigationMenu.Link>
  );
}

function MenuCards({ items }: { items: NavigationCardProps[] }) {
  return (
    <div className={styles.menuGrid}>
      {items.map((item) => (
        <MenuCard key={item.title} {...item} />
      ))}
    </div>
  );
}

function MenuSection({
  label,
  title,
  description,
  children,
}: {
  label: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <NavigationMenu.Item className={styles.menuItem}>
      <NavigationMenu.Trigger className={styles.menuTrigger}>
        {label}
        <ChevronDown aria-hidden="true" size={14} className={styles.chevron} />
      </NavigationMenu.Trigger>
      <NavigationMenu.Content className={styles.menuContent}>
        <div className={styles.menuHeading}>
          <span>{title}</span>
          <p>{description}</p>
        </div>
        {children}
      </NavigationMenu.Content>
    </NavigationMenu.Item>
  );
}

function MobileNavigation({ onNavigate }: { onNavigate: () => void }) {
  return (
    <nav className={styles.mobileNav} aria-label="Mobile navigation">
      <span className={styles.mobileEyebrow}>Explore Labai</span>
      <div className={styles.mobileGroup}>
        <span>Tools</span>
        {toolLinks.map((link) => (
          <Link key={link.href} href={link.href} onClick={onNavigate}>{link.title}</Link>
        ))}
      </div>
      <div className={styles.mobileGroup}>
        <span>How it works</span>
        {learnLinks.map((link) => (
          <Link key={link.href} href={link.href} onClick={onNavigate}>{link.title}</Link>
        ))}
      </div>
      <div className={styles.mobileGroup}>
        <span>Resources</span>
        {resourceLinks.map((link) => (
          <Link key={link.href} href={link.href} onClick={onNavigate}>{link.title}</Link>
        ))}
        <Link href="/login" onClick={onNavigate}>Sign in</Link>
      </div>
      <div className={styles.mobileUnavailable}>
        <Mic aria-hidden="true" size={16} />
        <span>Labscape AI is in every tool</span>
        <span className={styles.availabilityBadge}>Voice</span>
      </div>
    </nav>
  );
}

export function SiteHeader({ overlay = false, closeOnMount = false }: { overlay?: boolean; closeOnMount?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [closed, setClosed] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!closeOnMount || !headerRef.current) return;
    const header = headerRef.current;
    const spacer = spacerRef.current;
    const context = gsap.context(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(header, { autoAlpha: 0, yPercent: -120 });
        if (spacer) gsap.set(spacer, { height: 0 });
        setClosed(true);
        return;
      }

      gsap.timeline({ onComplete: () => setClosed(true) })
        .to(header, { autoAlpha: 0, yPercent: -120, duration: 0.38, ease: "power2.inOut" }, 0)
        .to(spacer, { height: 0, duration: 0.38, ease: "power2.inOut" }, 0);
    }, header);

    return () => context.revert();
  }, [closeOnMount]);

  return (
    <>
      {!closed && <header ref={headerRef} className={styles.header} aria-hidden={closeOnMount || undefined} inert={closeOnMount || undefined}>
        <div className={styles.bar}>
          <Brand />
          <NavigationMenu.Root
            className={styles.menuRoot}
            delayDuration={160}
            skipDelayDuration={100}
            aria-label="Main navigation"
          >
            <NavigationMenu.List className={styles.menuList}>
              <MenuSection
                label="Tools"
                title="Six machines to take apart."
                description="Each one is interactive, and every reading comes from a live model."
              >
                <MenuCards items={toolLinks} />
              </MenuSection>
              <MenuSection
                label="How it works"
                title="Explore, experiment, then ask."
                description="Three ways into every tool."
              >
                <MenuCards items={learnLinks} />
              </MenuSection>
              <MenuSection
                label="AI tutor"
                title="Labscape AI, built into every tool."
                description="It sees the tool you have open and can work its controls for you."
              >
                <div className={styles.integrationNote}>
                  <span className={styles.integrationIcon}>
                    <Mic aria-hidden="true" size={18} />
                  </span>
                  <span>
                    <strong>Press the orb and ask out loud.</strong>
                    <span>Talk in Bahasa Indonesia or English. Drag the orb anywhere on the page.</span>
                  </span>
                  <Link href={toolHref("engine")} className={styles.availabilityBadge}>
                    Try it <ArrowRight aria-hidden="true" size={12} />
                  </Link>
                </div>
              </MenuSection>
              <MenuSection
                label="Resources"
                title="Everything else."
                description="Open the full lab or inspect the visual rules."
              >
                <MenuCards items={resourceLinks} />
              </MenuSection>
            </NavigationMenu.List>
            <div className={styles.viewportPosition}>
              <NavigationMenu.Viewport className={styles.viewport} />
            </div>
          </NavigationMenu.Root>
          <div className={styles.actions}>
            <Link href="/login" className={styles.signIn}>Sign in</Link>
            <Button asChild size="sm" className={styles.getStarted}>
              <Link href="/start">
                Open the tools <ArrowRight aria-hidden="true" size={15} />
              </Link>
            </Button>
            <button
              className={styles.mobileTrigger}
              type="button"
              aria-label="Open navigation menu"
              aria-haspopup="dialog"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu aria-hidden="true" size={20} />
            </button>
          </div>
        </div>
      </header>}
      {!closed && !overlay && <div ref={spacerRef} className={styles.headerSpacer} aria-hidden="true" />}
      {!closed && <Dialog
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        title="Explore Labai"
        description="Open a tool, see how it works, or meet the AI tutor."
      >
        <MobileNavigation onNavigate={() => setMobileOpen(false)} />
      </Dialog>}
    </>
  );
}
