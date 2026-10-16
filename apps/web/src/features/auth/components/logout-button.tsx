"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return <button type="button" onClick={async () => {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (response.ok) router.replace("/login");
  }}>Sign out</button>;
}
