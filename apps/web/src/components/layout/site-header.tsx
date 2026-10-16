"use client";

import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  FileText,
  Layers2,
  Lightbulb,
  ListChecks,
  type LucideIcon,
  Menu,
  MessageSquare,
  Plug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import styles from "./site-header.module.css";

type NavigationCardProps = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const productLinks: NavigationCardProps[] = [
  {
    title: "Forms",
    description: "A clear, friendly way to ask.",
    href: "/#preview-forms",
    icon: FileText,
  },
  {
    title: "Surveys",
    description: "Make room for honest feedback.",
    href: "/#preview-surveys",
    icon: MessageSquare,
  },
  {
    title: "Quizzes",
    description: "Turn a question into a discovery.",
    href: "/#preview-quizzes",
    icon: ListChecks,
  },
];

const templateLinks: NavigationCardProps[] = [
  {
    title: "Customer feedback",
    description: "A thoughtful place for opinions.",
    href: "/#template-customer-feedback",
    icon: MessageSquare,
  },
  {
    title: "Event registration",
    description: "Get the important details first.",
    href: "/#template-event-registration",
    icon: FileText,
  },
  {
    title: "Say hello",
    description: "Start with a simple introduction.",
    href: "/#template-say-hello",
    icon: Lightbulb,
  },
];

const resourceLinks: NavigationCardProps[] = [
  {
    title: "Design system",
    description: "Tokens, components, and examples.",
    href: "/design-system",
    icon: Layers2,
  },
  {
    title: "Interactive preview",
    description: "Try the form, survey, and quiz demos.",
    href: "/#playground",
    icon: BookOpen,
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
        <span>Products</span>
        <Link href="/#preview-forms" onClick={onNavigate}>Forms</Link>
        <Link href="/#preview-surveys" onClick={onNavigate}>Surveys</Link>
        <Link href="/#preview-quizzes" onClick={onNavigate}>Quizzes</Link>
      </div>
      <div className={styles.mobileGroup}>
        <span>Templates</span>
        <Link href="/#template-customer-feedback" onClick={onNavigate}>Customer feedback</Link>
        <Link href="/#template-event-registration" onClick={onNavigate}>Event registration</Link>
        <Link href="/#template-say-hello" onClick={onNavigate}>Say hello</Link>
      </div>
      <div className={styles.mobileGroup}>
        <span>Resources</span>
        <Link href="/design-system" onClick={onNavigate}>Design system</Link>
        <Link href="/#playground" onClick={onNavigate}>Interactive preview</Link>
      </div>
      <div className={styles.mobileUnavailable}>
        <Plug aria-hidden="true" size={16} />
        <span>Integrations</span>
        <span className={styles.availabilityBadge}>Not in demo</span>
      </div>
    </nav>
  );
}

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className={styles.header}>
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
                label="Products"
                title="A small tool. A lot of possibility."
                description="Choose a format and explore the working preview."
              >
                <MenuCards items={productLinks} />
              </MenuSection>
              <MenuSection
                label="Templates"
                title="Start with a good first question."
                description="Jump to one of the ready-to-try ideas."
              >
                <MenuCards items={templateLinks} />
              </MenuSection>
              <MenuSection
                label="Integrations"
                title="Not part of this demo."
                description="The foundation currently demonstrates local forms, surveys, and quizzes."
              >
                <div className={styles.integrationNote}>
                  <span className={styles.integrationIcon}>
                    <Plug aria-hidden="true" size={18} />
                  </span>
                  <span>
                    <strong>No integrations are connected.</strong>
                    <span>This build stays focused on local product previews.</span>
                  </span>
                  <span className={styles.availabilityBadge}>Not in demo</span>
                </div>
              </MenuSection>
              <MenuSection
                label="Resources"
                title="A little more about the details."
                description="Inspect the visual rules or try the local demos."
              >
                <MenuCards items={resourceLinks} />
              </MenuSection>
            </NavigationMenu.List>
            <div className={styles.viewportPosition}>
              <NavigationMenu.Viewport className={styles.viewport} />
            </div>
          </NavigationMenu.Root>
          <div className={styles.actions}>
            <Button asChild size="sm" className={styles.getStarted}>
              <Link href="/#playground">
                Try it out <ArrowRight aria-hidden="true" size={15} />
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
      </header>
      {!overlay && <div className={styles.headerSpacer} aria-hidden="true" />}
      <Dialog
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        title="Explore Labai"
        description="Jump into a local product preview or inspect the design system."
      >
        <MobileNavigation onNavigate={() => setMobileOpen(false)} />
      </Dialog>
    </>
  );
}
