import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSession } from "@/features/auth/server/auth";
import { LogoutButton } from "@/features/auth/components/logout-button";
import styles from "@/features/auth/components/dashboard.module.css";

export const metadata: Metadata = { title: "Dashboard" };
export const instant = false;

export default async function DashboardPage() {
  await connection();
  const token = (await cookies()).get("labai_session")?.value;
  const user = getSession(token);
  if (!user) redirect("/login");

  return (
    <main id="main-content" className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>labai<span>.</span></Link>
        <LogoutButton />
      </header>
      <section className={styles.content}>
        <span className={styles.eyebrow}>Dashboard</span>
        <h1>Welcome back, {user.name}.</h1>
        <p>You are signed in as {user.email}.</p>
        <Link href="/start" className={styles.link}>Explore SVG tools →</Link>
      </section>
    </main>
  );
}
