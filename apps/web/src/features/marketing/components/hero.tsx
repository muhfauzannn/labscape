"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  FileText,
  ListChecks,
  MessageSquare,
  MousePointer2,
  Plus,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Heading, Text } from "@/components/ui/typography";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog } from "@/components/ui/dialog";
import { FormPreview } from "./form-preview";
import styles from "./hero.module.css";
const templates = ["Customer feedback", "Event registration", "Say hello"];
const previewKinds = ["forms", "surveys", "quizzes"] as const;

export function Hero() {
  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<(typeof previewKinds)[number]>("forms");
  const [tabDirection, setTabDirection] = useState<"forward" | "backward" | "none">("none");
  const currentKind = useRef<(typeof previewKinds)[number]>("forms");
  const tabChangeSource = useRef<"pointer" | "keyboard">("keyboard");

  const changeKind = useCallback((value: string) => {
    if (!previewKinds.includes(value as (typeof previewKinds)[number])) return;

    const nextKind = value as (typeof previewKinds)[number];
    const currentIndex = previewKinds.indexOf(currentKind.current);
    const nextIndex = previewKinds.indexOf(nextKind);

    if (nextKind !== currentKind.current) {
      setTabDirection(
        tabChangeSource.current === "pointer"
          ? nextIndex > currentIndex
            ? "forward"
            : "backward"
          : "none",
      );
      currentKind.current = nextKind;
    }

    setKind(nextKind);
  }, []);

  useEffect(() => {
    function selectPreviewFromHash() {
      const selected = window.location.hash.slice("#preview-".length);
      if (previewKinds.includes(selected as (typeof previewKinds)[number])) {
        changeKind(selected);
      }
    }

    selectPreviewFromHash();
    window.addEventListener("hashchange", selectPreviewFromHash);
    return () => window.removeEventListener("hashchange", selectPreviewFromHash);
  }, [changeKind]);

  function create(value: string) {
    setTitle(value.trim() || "Let’s make something great.");
    setPreview(true);
  }
  function closePreview(open: boolean) {
    setPreview(open);
  }
  return (
    <>
      <section
        className={styles.hero}
        aria-labelledby="hero-heading"
      >
        <Image
          className={styles.landscape}
          src="/images/hero-school.webp"
          alt=""
          fill
          sizes="100vw"
          preload
        />
        <div className={styles.atmosphere} />
        <div className={styles.heroCopy}>
          <Link
            href="/design-system"
            className={styles.announcement}
            data-hero-enter
          >
            <Badge tone="butter">
              A fresh foundation
            </Badge>
            <span>Meet the Labai design system</span>
            <ArrowRight aria-hidden="true" size={14} />
          </Link>
          <Heading
            as="h1"
            size="display"
            id="hero-heading"
            className={styles.heroHeading}
            data-hero-enter
          >
            <span>A little form.</span>
            <br />A world of possibilities.
          </Heading>
          <p className={styles.subtitle} data-hero-enter>
            Beautiful to fill out. Powerful behind the scenes.
          </p>
          <form
            className={styles.promptShell}
            data-hero-enter
            onSubmit={(e) => {
              e.preventDefault();
              create(prompt);
            }}
          >
            <div className={styles.promptInput}>
              <Sparkles aria-hidden="true" size={21} />
              <label className={styles.srOnly} htmlFor="hero-prompt">
                Describe your form
              </label>
              <Input
                id="hero-prompt"
                placeholder="What would you like to create?"
                value={prompt}
                maxLength={80}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <Button type="submit">
                Create a form <ArrowRight aria-hidden="true" size={16} />
              </Button>
            </div>
          </form>
          <div className={styles.suggestions} data-hero-enter>
            <span>Or start with</span>
            {templates.map((template) => (
              <button
                key={template}
                id={`template-${template.toLowerCase().replaceAll(" ", "-")}`}
                onClick={() => {
                  setPrompt(template);
                  create(template);
                }}
              >
                {template}
                <Plus aria-hidden="true" size={12} />
              </button>
            ))}
          </div>
          <p className={styles.microcopy} data-hero-enter>
            <Check aria-hidden="true" size={14} /> A working preview, in one
            click <span>·</span> No sign-up needed
          </p>
        </div>
        <div
          className={styles.productShell}
          id="playground"
          data-hero-enter
        >
          <Tabs value={kind} onValueChange={changeKind}>
            <TabsList
              aria-label="Preview type"
              className={styles.productTabs}
              onPointerDownCapture={() => {
                tabChangeSource.current = "pointer";
              }}
              onKeyDownCapture={() => {
                tabChangeSource.current = "keyboard";
              }}
            >
              <TabsTrigger value="forms" id="preview-forms">
                <FileText aria-hidden="true" size={16} /> Forms
              </TabsTrigger>
              <TabsTrigger value="surveys" id="preview-surveys">
                <MessageSquare aria-hidden="true" size={16} /> Surveys
              </TabsTrigger>
              <TabsTrigger value="quizzes" id="preview-quizzes">
                <ListChecks aria-hidden="true" size={16} /> Quizzes
              </TabsTrigger>
            </TabsList>
            {previewKinds.map((type) => (
              <TabsContent
                key={type}
                value={type}
                className={styles.productContent}
                data-direction={tabDirection}
              >
                <div className={styles.productInfo}>
                  <Badge
                    tone={
                      type === "forms"
                        ? "mint"
                        : type === "surveys"
                          ? "sky"
                          : "lilac"
                    }
                  >
                    <span className={styles.statusDot} /> Made for real
                    connections
                  </Badge>
                  <Heading size="section">
                    {type === "forms" ? (
                      <>
                        Less friction.
                        <br />
                        More possibilities.
                      </>
                    ) : type === "surveys" ? (
                      <>
                        Better questions.
                        <br />
                        Brighter insights.
                      </>
                    ) : (
                      <>
                        A little curiosity.
                        <br />A lot to discover.
                      </>
                    )}
                  </Heading>
                  <Text>
                    {type === "forms"
                      ? "Turn a simple question into your next big thing. Build forms that feel as good as they work."
                      : type === "surveys"
                        ? "Make space for honest feedback. Give every response a thoughtful place to land."
                        : "Make learning feel like a conversation. Start with a question and see where it takes you."}
                  </Text>
                  <ul>
                    <li>
                      <MousePointer2 aria-hidden="true" size={16} /> Simple,
                      intuitive interactions
                    </li>
                    <li>
                      <WandSparkles aria-hidden="true" size={16} /> Thoughtful
                      design in every detail
                    </li>
                    <li>
                      <Check aria-hidden="true" size={16} /> Accessible from the
                      very first field
                    </li>
                  </ul>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      create(
                        type === "forms"
                          ? "Let’s make something great."
                          : type === "surveys"
                            ? "We’d love your feedback."
                            : "Ready for a little quiz?",
                      )
                    }
                  >
                    Explore the preview{" "}
                    <ArrowRight aria-hidden="true" size={16} />
                  </Button>
                </div>
                <div className={styles.previewCanvas}>
                  <div className={styles.browserBar}>
                    <span />
                    <span />
                    <span />
                    <span className={styles.browserLabel}>
                      Your next great connection
                    </span>
                  </div>
                  <div className={styles.previewCard}>
                    <FormPreview
                      key={type}
                      compact
                      title={
                        type === "forms"
                          ? "Let’s make something great."
                          : type === "surveys"
                            ? "We’d love your feedback."
                            : "Ready for a little quiz?"
                      }
                    />
                  </div>
                  <span className={styles.madeWith}>
                    a little magic, made with <strong>labai.</strong>
                  </span>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>
      <section className={styles.foundation}>
        <span className={styles.eyebrow}>
          SMALL DETAILS. ONE COHERENT SYSTEM.
        </span>
        <Heading size="title">Built to feel effortless.</Heading>
        <Text>
          Every button, every field, every little interaction. All speaking the
          same language.
        </Text>
        <Link href="/design-system">
          Explore the design system <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </section>
      <footer className={styles.footer}>
        <span>
          labai. <span>A thoughtful beginning.</span>
        </span>
        <Link href="/design-system">
          Design system <ArrowRight aria-hidden="true" size={14} />
        </Link>
        <span>Foundation v1.0</span>
      </footer>
      <Dialog
        open={preview}
        onOpenChange={closePreview}
        title="Your form, brought to life."
        description="Try this local preview. Your responses won’t be sent or saved."
      >
        <FormPreview key={`${title}-${preview}`} title={title} />
      </Dialog>
    </>
  );
}
