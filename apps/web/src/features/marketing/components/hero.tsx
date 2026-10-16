"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  AudioLines,
  Boxes,
  Check,
  Eye,
  Hand,
  Mic,
  MousePointer2,
  Play,
  ScanSearch,
  SlidersHorizontal,
  Sparkles,
  Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Heading, Text } from "@/components/ui/typography";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { matchTool, toolCatalog, toolHref, type ToolId } from "@/lib/tool-catalog";
import styles from "./hero.module.css";

const quickTools: ToolId[] = ["rocket", "engine", "printer", "microscope-lab"];
const previewKinds = ["explore", "experiment", "ask"] as const;
type PreviewKind = (typeof previewKinds)[number];

const previews = {
  explore: {
    tab: "Explore",
    icon: Boxes,
    tone: "mint",
    badge: "Exploded views",
    heading: ["See every part.", "Then see inside it."],
    text: "Pull a 3D printer apart, open up an engine or follow one keystroke through a typewriter. Click any part to learn what it does.",
    points: [
      { icon: MousePointer2, text: "Click any part to inspect it" },
      { icon: Boxes, text: "Exploded and see-through views" },
      { icon: ScanSearch, text: "Isolate one part at a time" },
    ],
    tool: "printer",
    cta: "Take the 3D printer apart",
    image: { src: "/images/tools/printer.jpg", width: 1400, height: 1029, alt: "The 3D printer in exploded view, paused mid-print with an orange cube on the bed." },
  },
  experiment: {
    tab: "Experiment",
    icon: SlidersHorizontal,
    tone: "sky",
    badge: "Live models",
    heading: ["Change one thing.", "Watch everything respond."],
    text: "Every control drives a real model. Throttle the rocket and its thrust-to-weight ratio decides whether it lifts off. Print faster than the nozzle can melt and the layers come out thin.",
    points: [
      { icon: SlidersHorizontal, text: "Power, speed and temperature controls" },
      { icon: Gauge, text: "Live readings from the same model" },
      { icon: Play, text: "Start, pause and reset any time" },
    ],
    tool: "rocket",
    cta: "Launch the rocket",
    image: { src: "/images/tools/rocket.jpg", width: 1400, height: 901, alt: "The rocket on its launch pad at ignition, with live readings for height, climbing speed, engine push and lift versus weight." },
  },
  ask: {
    tab: "Ask AI",
    icon: AudioLines,
    tone: "lilac",
    badge: "Labscape AI",
    heading: ["Stuck? Just ask,", "out loud."],
    text: "Labscape AI sees the tool you have open and what it is doing right now. Ask why the piston moves and it explains, or have it work the controls for you.",
    points: [
      { icon: Mic, text: "Talk in Bahasa Indonesia or English" },
      { icon: Eye, text: "Knows what is on your screen" },
      { icon: Hand, text: "Works the controls when you ask" },
    ],
    tool: "engine",
    cta: "Ask about the engine",
    image: { src: "/images/tools/engine.jpg", width: 1400, height: 924, alt: "The two-cylinder engine running, with its pistons, valves and crankshaft visible." },
  },
} as const satisfies Record<PreviewKind, unknown>;

export function Hero() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [noMatch, setNoMatch] = useState(false);
  const [kind, setKind] = useState<PreviewKind>("explore");
  const [tabDirection, setTabDirection] = useState<"forward" | "backward" | "none">("none");
  const currentKind = useRef<PreviewKind>("explore");
  const tabChangeSource = useRef<"pointer" | "keyboard">("keyboard");

  const changeKind = useCallback((value: string) => {
    if (!previewKinds.includes(value as PreviewKind)) return;
    const nextKind = value as PreviewKind;
    const currentIndex = previewKinds.indexOf(currentKind.current);
    const nextIndex = previewKinds.indexOf(nextKind);
    if (nextKind !== currentKind.current) {
      setTabDirection(
        tabChangeSource.current === "pointer" ? (nextIndex > currentIndex ? "forward" : "backward") : "none",
      );
      currentKind.current = nextKind;
    }
    setKind(nextKind);
  }, []);

  useEffect(() => {
    function selectPreviewFromHash() {
      const selected = window.location.hash.slice("#learn-".length);
      if (previewKinds.includes(selected as PreviewKind)) changeKind(selected);
    }
    selectPreviewFromHash();
    window.addEventListener("hashchange", selectPreviewFromHash);
    return () => window.removeEventListener("hashchange", selectPreviewFromHash);
  }, [changeKind]);

  function explore(value: string) {
    const match = matchTool(value);
    if (match) router.push(toolHref(match));
    else setNoMatch(Boolean(value.trim()));
  }

  return (
    <>
      <section className={styles.hero} aria-labelledby="hero-heading">
        <Image className={styles.landscape} src="/images/hero-school.webp" alt="" fill sizes="100vw" preload />
        <div className={styles.atmosphere} />
        <div className={styles.heroCopy}>
          <Link href={toolHref("engine")} className={styles.announcement} data-hero-enter>
            <Badge tone="butter">New</Badge>
            <span>Ask the tools out loud with Labscape AI</span>
            <ArrowRight aria-hidden="true" size={14} />
          </Link>
          <Heading as="h1" size="display" id="hero-heading" className={styles.heroHeading} data-hero-enter>
            <span>Don’t just read about it.</span>
            <br />
            Take it apart.
          </Heading>
          <p className={styles.subtitle} data-hero-enter>
            Interactive machines you can press, turn and pull apart, with an AI tutor that sees what you see.
          </p>
          <form
            className={styles.promptShell}
            data-hero-enter
            onSubmit={(event) => {
              event.preventDefault();
              explore(prompt);
            }}
          >
            <div className={styles.promptInput}>
              <Sparkles aria-hidden="true" size={21} />
              <label className={styles.srOnly} htmlFor="hero-prompt">
                What do you want to understand?
              </label>
              <Input
                id="hero-prompt"
                placeholder="How does a rocket lift off?"
                value={prompt}
                maxLength={80}
                aria-describedby="hero-prompt-note"
                onChange={(event) => {
                  setPrompt(event.target.value);
                  setNoMatch(false);
                }}
              />
              <Button type="submit">
                Explore <ArrowRight aria-hidden="true" size={16} />
              </Button>
            </div>
          </form>
          <p id="hero-prompt-note" className={styles.matchNote} aria-live="polite" data-visible={noMatch}>
            {noMatch ? "No machine for that yet. Try a rocket, an engine, a microscope or a 3D printer." : ""}
          </p>
          <div className={styles.suggestions} data-hero-enter>
            <span>Or open</span>
            {quickTools.map((id) => (
              <Link key={id} href={toolHref(id)} id={`tool-${id}`}>
                {toolCatalog.find((tool) => tool.id === id)!.label}
                <ArrowRight aria-hidden="true" size={12} />
              </Link>
            ))}
          </div>
          <p className={styles.microcopy} data-hero-enter>
            <Check aria-hidden="true" size={14} /> Runs in your browser <span>·</span> Ask in Bahasa Indonesia or English
          </p>
        </div>
        <div className={styles.productShell} id="learn" data-hero-enter>
          <Tabs value={kind} onValueChange={changeKind}>
            <TabsList
              aria-label="How you learn with Labai"
              className={styles.productTabs}
              onPointerDownCapture={() => {
                tabChangeSource.current = "pointer";
              }}
              onKeyDownCapture={() => {
                tabChangeSource.current = "keyboard";
              }}
            >
              {previewKinds.map((type) => {
                const Icon = previews[type].icon;
                return (
                  <TabsTrigger key={type} value={type} id={`learn-${type}`}>
                    <Icon aria-hidden="true" size={16} /> {previews[type].tab}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {previewKinds.map((type) => {
              const preview = previews[type];
              return (
                <TabsContent key={type} value={type} className={styles.productContent} data-direction={tabDirection}>
                  <div className={styles.productInfo}>
                    <Badge tone={preview.tone}>
                      <span className={styles.statusDot} /> {preview.badge}
                    </Badge>
                    <Heading size="section">
                      {preview.heading[0]}
                      <br />
                      {preview.heading[1]}
                    </Heading>
                    <Text>{preview.text}</Text>
                    <ul>
                      {preview.points.map(({ icon: Icon, text }) => (
                        <li key={text}>
                          <Icon aria-hidden="true" size={16} /> {text}
                        </li>
                      ))}
                    </ul>
                    <Button asChild variant="secondary">
                      <Link href={toolHref(preview.tool)}>
                        {preview.cta} <ArrowRight aria-hidden="true" size={16} />
                      </Link>
                    </Button>
                  </div>
                  <div className={styles.previewCanvas}>
                    <Link href={toolHref(preview.tool)} className={styles.shot} aria-label={`Open ${preview.cta.toLowerCase()}`}>
                      <Image
                        src={preview.image.src}
                        width={preview.image.width}
                        height={preview.image.height}
                        alt={preview.image.alt}
                        sizes="(max-width: 600px) 100vw, 640px"
                      />
                      {type === "ask" && (
                        <span className={styles.askBubble} aria-hidden="true">
                          <span className={styles.askTop}>
                            <AudioLines size={13} /> Labscape AI <em>Example</em>
                          </span>
                          <span className={styles.askUser}>“Kenapa pistonnya turun?”</span>
                          <span className={styles.askReply}>
                            Itu langkah usaha. Busi baru menyalakan campuran bahan bakar, dan tekanannya mendorong piston ke bawah.
                          </span>
                        </span>
                      )}
                    </Link>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </section>
      <section className={styles.foundation}>
        <span className={styles.eyebrow}>SIX MACHINES. ONE AI TUTOR.</span>
        <Heading size="title">Learn by doing, not by scrolling.</Heading>
        <Text>
          Every number on screen comes from the same model that moves the parts, so what you see is how it really works.
        </Text>
        <Link href="/start">
          Open the tools <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </section>
      <footer className={styles.footer}>
        <span>
          labai. <span>Learn how things work.</span>
        </span>
        <Link href="/start">
          Interactive tools <ArrowRight aria-hidden="true" size={14} />
        </Link>
        <Link href="/design-system">Design system</Link>
      </footer>
    </>
  );
}
