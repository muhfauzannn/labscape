"use client";
import { useId, useState } from "react";
import { ArrowRight, Check, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import styles from "./hero.module.css";
export function FormPreview({
  title = "Let’s make something great.",
  compact = false,
}: {
  title?: string;
  compact?: boolean;
}) {
  const id = useId();
  const [submitted, setSubmitted] = useState(false);
  if (submitted)
    return (
      <div className={styles.success} role="status">
        <span className={styles.successIcon}>
          <Check aria-hidden="true" size={28} />
        </span>
        <h3>You’re all set!</h3>
        <p>Your demo response is complete. Nothing was sent or stored.</p>
        <Button variant="secondary" onClick={() => setSubmitted(false)}>
          <RotateCcw aria-hidden="true" size={15} /> Try again
        </Button>
      </div>
    );
  return (
    <form
      className={styles.formPreview}
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
      }}
    >
      <span className={styles.formIcon}>
        <Sparkles aria-hidden="true" size={21} />
      </span>
      <h3>{title}</h3>
      <p>A good conversation starts with a simple hello.</p>
      <Field id={`${id}-name`} label="What’s your name?">
        <Input
          id={`${id}-name`}
          name="name"
          placeholder="Your name"
          autoComplete="name"
          required
          maxLength={100}
        />
      </Field>
      {!compact && (
        <Field id={`${id}-email`} label="And your email?">
          <Input
            id={`${id}-email`}
            name="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            required
            maxLength={254}
          />
        </Field>
      )}
      <Button type="submit">
        Send a little hello <ArrowRight aria-hidden="true" size={16} />
      </Button>
      <span className={styles.formNote}>
        Interactive demo · responses aren’t saved
      </span>
    </form>
  );
}
