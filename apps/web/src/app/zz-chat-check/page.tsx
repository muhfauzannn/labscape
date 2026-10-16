"use client";
// TEMPORARY: visual check of the assistant chat panel. Delete after verifying.
import { useRef } from "react";
import { LiveAssistant } from "@/features/svg-tools/live-assistant";
import "@/features/svg-tools/svg-tools.css";

export default function ChatCheck() {
  const root = useRef<HTMLDivElement>(null);
  return (
    <main className="svg-tools iso" data-theme="light">
      <div ref={root} style={{ height: "80vh" }}><button type="button">Start</button></div>
      <LiveAssistant toolId="engine" toolLabel="Engine" toolRoot={root} initialQuestion="Apa fungsi piston? Jawab satu kalimat." />
    </main>
  );
}
