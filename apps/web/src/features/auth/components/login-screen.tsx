"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Check, Eye, EyeOff, LockKeyhole, Mail, MousePointer2 } from "lucide-react";
import styles from "./login-screen.module.css";

export function LoginScreen() {
  const router = useRouter();
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
      router.replace("/dashboard");
      router.refresh();
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
          <p className={styles.help}>Sign in with the account provided to you.</p>
        </div>
      </div>

      <aside className={styles.visual} aria-label="Labai product preview">
        <div className={styles.visualCopy}>
          <h2>Make every response count.</h2>
          <p>Collect answers beautifully, then put them to work.</p>
        </div>
        <div className={styles.art} aria-hidden="true">
          <div className={styles.tableCard}>
            <div className={styles.tableTitle}><span className={styles.sheetIcon}>▦</span> Registrations</div>
            <div className={styles.tableHeader}><span>Name</span><span>Submitted</span><span>Status</span></div>
            <div className={styles.tableRow}><strong>Maya Chen</strong><span>Just now</span><span className={styles.newBadge}>New</span></div>
            <div className={styles.tableGhost}><span /><span /><span /></div>
            <div className={styles.tableGhost}><span /><span /><span /></div>
            <div className={styles.tableGhost}><span /><span /><span /></div>
          </div>
          <div className={styles.formCard}>
            <div className={styles.formTitle}><span className={styles.formIcon}>▣</span> Summit registration</div>
            <div className={styles.previewField}>Name <span>Maya Chen</span></div>
            <div className={styles.previewField}>Email <span>maya@northwind.co</span></div>
            <div className={styles.previewButton}>Submit</div>
            <MousePointer2 className={styles.pointer} size={26} fill="#3262bc" stroke="white" />
          </div>
          <div className={styles.sentCard}><span className={styles.sentIcon}>↪</span> Send confirmation <span className={styles.sentBadge}><Check size={11} /> Sent</span></div>
          <div className={styles.chartCard}>
            <div className={styles.chartTitle}><span>✦</span> Attendance</div>
            <div className={styles.bars}>{[30, 38, 33, 52, 44, 65, 76].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
          </div>
        </div>
      </aside>
    </div>
  );
}
