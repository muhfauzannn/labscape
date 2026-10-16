"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCheck,
  Copy,
  ExternalLink,
  FileText,
  Layers2,
  Palette,
  Sparkles,
  Type,
  SlidersHorizontal,
  Square,
  MousePointer2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heading, Text } from "@/components/ui/typography";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog } from "@/components/ui/dialog";
import styles from "./design-system.module.css";
const sections = [
  { id: "overview", label: "Overview", icon: Layers2 },
  { id: "colors", label: "Color palette", icon: Palette },
  { id: "typography", label: "Typography", icon: Type },
  { id: "buttons", label: "Buttons", icon: MousePointer2 },
  { id: "inputs", label: "Form controls", icon: SlidersHorizontal },
  { id: "surfaces", label: "Cards & badges", icon: Square },
  { id: "interactions", label: "Tabs & dialogs", icon: FileText },
  { id: "imagery", label: "Imagery", icon: Sparkles },
];
const colors = [
  { name: "Ink", token: "--ink", hex: "#242824" },
  { name: "Canvas", token: "--canvas", hex: "#FBFBFA" },
  { name: "Sky", token: "--sky", hex: "#2798D0" },
  { name: "Meadow", token: "--mint-soft", hex: "#EAF2E5" },
  { name: "Butter", token: "--butter-soft", hex: "#FFF3CC" },
  { name: "Lilac", token: "--lilac-soft", hex: "#F0EAFA" },
];
function Section({
  id,
  number,
  title,
  description,
  children,
}: {
  id: string;
  number: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.section}>
      <div className={styles.sectionHeading}>
        <span>{number}</span>
        <div>
          <Heading size="title">{title}</Heading>
          <Text>{description}</Text>
        </div>
      </div>
      {children}
    </section>
  );
}
export function DesignSystem() {
  const [active, setActive] = useState("overview");
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState("");
  const [dialog, setDialog] = useState(false);
  const [notice, setNotice] = useState("");
  async function copy(hex: string) {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(hex);
      setCopyError("");
    } catch {
      setCopyError(`Copy unavailable. Select this value: ${hex}`);
    }
  }
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTitle}>
          THE LABSCAPE LANGUAGE <Badge>1.0</Badge>
        </div>
        <nav aria-label="Design system sections">
          {sections.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={active === id ? "location" : undefined}
              onClick={() => setActive(id)}
            >
              <Icon aria-hidden="true" size={16} />
              {label}
              {active === id && <span className={styles.activeDot} />}
            </a>
          ))}
        </nav>
        <div className={styles.sideNote}>
          <span className={styles.greenDot} /> A living system
          <p>
            Small details.
            <br />
            Beautifully consistent.
          </p>
          <Link href="/">
            See it in the wild <ExternalLink aria-hidden="true" size={12} />
          </Link>
        </div>
      </aside>
      <main id="main-content" className={styles.main}>
        <section id="overview" className={styles.intro}>
          <div className={styles.breadcrumb}>
            FOUNDATIONS <span>/</span> DESIGN SYSTEM
          </div>
          <div className={styles.introHeading}>
            <Heading as="h1" size="display">
              Considered.
              <br />
              <span>Down to the pixel.</span>
            </Heading>
            <div className={styles.introArt}>
              <Layers2 aria-hidden="true" size={64} strokeWidth={1.2} />
              <span>
                the little things
                <br />
                make the whole.
              </span>
            </div>
          </div>
          <Text>
            The building blocks of a more thoughtful experience.
            <br />
            One visual language. Endless possibilities.
          </Text>
          <div className={styles.introMeta}>
            <Badge tone="mint">
              <Check aria-hidden="true" size={12} /> Ready to build
            </Badge>
            <span>Version 1.0</span>
            <span className={styles.divider} />
            Inspired by Fillout. Crafted for Labscape.
            <a href="#colors">
              Explore the system <ArrowDown aria-hidden="true" size={13} />
            </a>
          </div>
        </section>
        <div className={styles.principles}>
          <div>
            <span>01</span>
            <strong>Clarity comes first.</strong>
            <p>Make the next step feel obvious.</p>
          </div>
          <div>
            <span>02</span>
            <strong>Warm, never noisy.</strong>
            <p>A little personality. Room to breathe.</p>
          </div>
          <div>
            <span>03</span>
            <strong>Consistency is care.</strong>
            <p>Familiar patterns, everywhere.</p>
          </div>
        </div>
        <Section
          id="colors"
          number="01"
          title="A naturally good palette."
          description="Grounded neutrals. A breath of blue. Just enough color to make things feel human."
        >
          <div className={styles.swatches}>
            {colors.map((color) => (
              <button
                key={color.token}
                className={styles.swatch}
                onClick={() => copy(color.hex)}
                aria-label={`Copy ${color.name}: ${color.hex}`}
              >
                <span
                  className={styles.colorBlock}
                  style={{ background: `var(${color.token})` }}
                >
                  {copied === color.hex ? (
                    <CheckCheck aria-hidden="true" size={16} />
                  ) : (
                    <Copy aria-hidden="true" size={14} />
                  )}
                </span>
                <strong>{color.name}</strong>
                <span>{color.hex}</span>
                <code>{color.token}</code>
              </button>
            ))}
          </div>
          <p className={styles.annotation} role="status">
            {copyError ||
              (copied
                ? `${copied} copied to clipboard.`
                : "Click any swatch to copy its value. Use semantic tokens, always.")}
          </p>
        </Section>
        <Section
          id="typography"
          number="02"
          title="Words with a little warmth."
          description="DM Sans brings a friendly rhythm to clear, confident communication."
        >
          <Card className={styles.typeCard}>
            <div className={styles.typeHero}>
              <span className={styles.bigAa}>Aa</span>
              <div>
                <Badge>OUR TYPEFACE</Badge>
                <h3>DM Sans</h3>
                <p>Open source. Self-hosted. Effortlessly readable.</p>
                <span>
                  Regular 400 <span>·</span> Medium 500 <span>·</span> Semibold
                  600
                </span>
              </div>
            </div>
            <div className={styles.typeRow}>
              <code>Display / 68 / 1.06</code>
              <span className={styles.displaySample}>
                Make room for possibility.
              </span>
            </div>
            <div className={styles.typeRow}>
              <code>Heading / 40 / 1.15</code>
              <Heading>Simple feels better.</Heading>
            </div>
            <div className={styles.typeRow}>
              <code>Title / 22 / 1.15</code>
              <Heading as="h3" size="title">Good things start here.</Heading>
            </div>
            <div className={styles.typeRow}>
              <code>Body / 16 / 1.6</code>
              <Text>
                Every detail is a chance to make someone’s day a little easier.
              </Text>
            </div>
            <div className={styles.typeRow}>
              <code>Caption / 12 / 1.5</code>
              <span className={styles.caption}>
                A small note can make a big difference.
              </span>
            </div>
          </Card>
        </Section>
        <Section
          id="buttons"
          number="03"
          title="A clear next step."
          description="Three variants. Five states. One consistent invitation to act."
        >
          <Card className={styles.stateCard}>
            <div className={styles.stateTable}>
              <div className={styles.tableHead}>
                <span>VARIANT</span>
                {["Default", "Hover", "Active", "Focus", "Disabled"].map(
                  (state) => (
                    <span key={state}>{state}</span>
                  ),
                )}
              </div>
              {(["primary", "secondary", "ghost"] as const).map((variant) => (
                <div className={styles.stateRow} key={variant}>
                  <span>{variant}</span>
                  {["default", "hover", "active", "focus", "disabled"].map(
                    (state) => (
                      <Button
                        key={state}
                        size="sm"
                        variant={variant}
                        data-preview={state}
                        disabled={state === "disabled"}
                        onClick={() =>
                          setNotice(`${variant} button activated.`)
                        }
                      >
                        Continue <ArrowRight aria-hidden="true" size={13} />
                      </Button>
                    ),
                  )}
                </div>
              ))}
            </div>
            <div className={styles.buttonSizes}>
              <span>SIZED FOR THE MOMENT</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setNotice("Small button activated.")}
              >
                Small
              </Button>
              <Button onClick={() => setNotice("Default button activated.")}>
                Default <ArrowRight aria-hidden="true" size={15} />
              </Button>
              <Button
                size="lg"
                onClick={() => setNotice("Large button activated.")}
              >
                Let’s get started <ArrowRight aria-hidden="true" size={16} />
              </Button>
            </div>
            <p className={styles.annotation} role="status">
              {notice ||
                "State samples stay visible for comparison. All enabled buttons are interactive."}
            </p>
          </Card>
        </Section>
        <Section
          id="inputs"
          number="04"
          title="A better way to ask."
          description="Persistent labels, helpful hints, and feedback exactly where it’s needed."
        >
          <Card>
            <div className={styles.fields}>
              {[
                {
                  state: "default",
                  label: "Default",
                  hint: "Keep questions short and human.",
                },
                {
                  state: "hover",
                  label: "Hover",
                  hint: "A slightly stronger border.",
                },
                {
                  state: "active",
                  label: "Active",
                  hint: "A deliberate pressed state.",
                },
                {
                  state: "focus",
                  label: "Focus",
                  hint: "A visible ring for every keyboard user.",
                },
                {
                  state: "error",
                  label: "Error",
                  hint: "Please enter a valid email address.",
                },
                {
                  state: "disabled",
                  label: "Disabled",
                  hint: "Unavailable, with a clear reason.",
                },
              ].map(({ state, label, hint }) => (
                <Field
                  key={state}
                  id={`sample-${state}`}
                  label={label}
                  {...(state === "error" ? { error: hint } : { hint })}
                >
                  <Input
                    id={`sample-${state}`}
                    data-preview={state}
                    type="email"
                    placeholder="you@company.com"
                    defaultValue={
                      state === "error" ? "not-quite-an-email" : undefined
                    }
                    disabled={state === "disabled"}
                    aria-invalid={state === "error" ? true : undefined}
                    aria-describedby={`sample-${state}-description`}
                  />
                </Field>
              ))}
            </div>
          </Card>
        </Section>
        <Section
          id="surfaces"
          number="05"
          title="A place for everything."
          description="Quiet surfaces, soft corners, and meaningful accents. Let the content do the talking."
        >
          <div className={styles.cards}>
            <Card>
              <span className={styles.cardIcon}>
                <FileText aria-hidden="true" size={21} />
              </span>
              <Badge tone="mint">Ready to use</Badge>
              <Heading as="h3" size="title">
                A thoughtful container.
              </Heading>
              <Text>
                Group what belongs together. Give every idea a little breathing
                room.
              </Text>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setNotice(
                    "Cards use 24px padding, 16px corners, and a subtle border.",
                  )
                }
              >
                See the details <ArrowRight aria-hidden="true" size={14} />
              </Button>
            </Card>
            <Card className={styles.badgeCard}>
              <span className={styles.smallLabel}>A LITTLE CONTEXT</span>
              <Heading as="h3" size="title">
                Small but meaningful.
              </Heading>
              <Text>
                Color carries meaning. Pair every status with a clear text
                label.
              </Text>
              <div className={styles.badges}>
                <Badge>Draft</Badge>
                <Badge tone="mint">
                  <Check aria-hidden="true" size={12} />
                  Published
                </Badge>
                <Badge tone="sky">In progress</Badge>
                <Badge tone="lilac">
                  <Sparkles aria-hidden="true" size={12} />
                  New
                </Badge>
                <Badge tone="butter">Needs review</Badge>
              </div>
              <span className={styles.annotation}>
                Badges communicate status; they aren’t buttons.
              </span>
            </Card>
          </div>
          <div className={styles.geometry}>
            <div>
              <span>4 / 8 / 12 / 16 / 24 / 32 / 48 / 64</span>
              <p>Spacing · a 4px rhythm</p>
            </div>
            <div>
              <span>
                8px <Square aria-hidden="true" size={22} /> 16px{" "}
                <Square aria-hidden="true" size={28} /> 24px
              </span>
              <p>Corners · control / card / panel</p>
            </div>
            <div>
              <span className={styles.shadowDemo} />
              <p>Shadows · depth with restraint</p>
            </div>
          </div>
        </Section>
        <Section
          id="interactions"
          number="06"
          title="Familiar, by design."
          description="Keyboard-friendly navigation and focused dialogs. Predictable at every turn."
        >
          <Card className={styles.interactionCard}>
            <div>
              <Tabs defaultValue="design">
                <TabsList aria-label="System principles">
                  <TabsTrigger value="design">Design</TabsTrigger>
                  <TabsTrigger value="build">Build</TabsTrigger>
                  <TabsTrigger value="later" disabled>
                    Coming soon
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="design" className={styles.tabContent}>
                  <Heading size="title">Start with intention.</Heading>
                  <Text>
                    Use shared tokens and components to make every screen feel
                    like home.
                  </Text>
                </TabsContent>
                <TabsContent value="build" className={styles.tabContent}>
                  <Heading size="title">Build on the foundation.</Heading>
                  <Text>
                    Compose shared primitives inside features. Keep routes thin
                    and behavior close to its owner.
                  </Text>
                </TabsContent>
              </Tabs>
              <p className={styles.annotation}>
                Use ← and → to move between tabs.
              </p>
            </div>
            <div className={styles.dialogDemo}>
              <span className={styles.cardIcon}>
                <Layers2 aria-hidden="true" size={22} />
              </span>
              <Heading as="h3" size="title">
                A moment of focus.
              </Heading>
              <Text>A calm space for one clear task.</Text>
              <Button variant="secondary" onClick={() => setDialog(true)}>
                Open a dialog <ExternalLink aria-hidden="true" size={14} />
              </Button>
            </div>
          </Card>
        </Section>
        <Section
          id="imagery"
          number="07"
          title="A brighter kind of backdrop."
          description="A welcoming school campus, warm light, and room for possibility. Optimism, illustrated."
        >
          <div className={styles.imageExample}>
            <Image
              src="/images/hero-school.webp"
              alt="Welcoming school campus with a cream school building, leafy trees, and a small bus under a clear blue sky."
              width={1536}
              height={1024}
              sizes="(max-width: 800px) 100vw, 900px"
            />
            <div>
              <Badge tone="butter">THE ART DIRECTION</Badge>
              <Heading>Room to imagine.</Heading>
              <p>
                Rich blue skies. Warm afternoon light.
                <br />
                A welcoming campus, thoughtfully composed.
              </p>
              <Button asChild variant="secondary">
                <Link href="/">
                  See the hero <ArrowRight aria-hidden="true" size={15} />
                </Link>
              </Button>
            </div>
          </div>
          <p className={styles.annotation}>
            Original AI-generated artwork. Exact prompt, palette, composition,
            and reproduction rules are recorded in docs/DESIGN.md.
          </p>
        </Section>
        <footer className={styles.footer}>
          <span>
            <strong>labscape.</strong> Made of thoughtful little things.
          </span>
          <a href="#overview" onClick={() => setActive("overview")}>
            Back to top ↑
          </a>
        </footer>
      </main>
      <Dialog
        open={dialog}
        onOpenChange={setDialog}
        title="A little room to focus."
        description="Dialogs bring one decision into view. Escape closes this dialog and focus returns to the opener."
      >
        <div className={styles.dialogBody}>
          <Badge tone="mint">
            <Check aria-hidden="true" size={12} />
            Accessible by default
          </Badge>
          <Text>
            Focus stays inside this dialog while it’s open. The background rests
            until you’re done.
          </Text>
          <Button onClick={() => setDialog(false)}>
            Got it <Check aria-hidden="true" size={15} />
          </Button>
        </div>
      </Dialog>
      {notice && (
        <div className={styles.toast} role="status">
          <Check aria-hidden="true" size={16} />
          {notice}
          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
