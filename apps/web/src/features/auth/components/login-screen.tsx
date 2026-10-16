"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import styles from "./login-screen.module.css";

export function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.message || "Tidak dapat masuk saat ini.");
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      const destination = next === "/start" || next?.startsWith("/start?") ? next : "/dashboard";
      window.location.replace(destination);
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.formSide}>
        <div className={styles.formContent}>
          <Link className={styles.brand} href="/" aria-label="Labai home">labai<span>.</span></Link>
          <h1>Sign in to Labai</h1>
          <p className={styles.intro}>Welcome back. Please sign in to continue.</p>

          <form onSubmit={submit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="login-email">Email</label>
              <div className={styles.inputWrap}>
                <Mail aria-hidden="true" size={16} />
                <input id="login-email" name="email" type="email" autoComplete="username" required maxLength={254} placeholder="you@example.com" aria-describedby={error ? "login-error" : undefined} />
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="login-password">Password</label>
              <div className={styles.inputWrap}>
                <LockKeyhole aria-hidden="true" size={16} />
                <input id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required placeholder="Enter your password" aria-describedby={error ? "login-error" : undefined} />
                <button className={styles.reveal} type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff aria-hidden="true" size={17} /> : <Eye aria-hidden="true" size={17} />}
                </button>
              </div>
            </div>
            {error && <p className={styles.error} id="login-error" role="alert">{error}</p>}
            <button className={styles.submit} type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in with email"}</button>
          </form>
        </div>
      </div>

      <aside className={styles.visual} aria-label="Labai interactive learning">
        <Image
          className={styles.visualImage}
          src="/images/login-lab.png"
          alt=""
          fill
          sizes="(max-width: 700px) 0px, 50vw"
          preload
        />
        <div className={styles.visualCopy}>
          <h2>Learn how things work.</h2>
          <p>Explore machines, try the controls, and discover what makes them move.</p>
        </div>
      </aside>
    </div>
  );
}
