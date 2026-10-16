"use client";

import { ArrowUp, Mic, MicOff, Volume2, VolumeX, X } from "lucide-react";
import Orb from "@/components/react-bits/Orb";
import { toolCatalog } from "@/lib/tool-catalog";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

/** "ready" is a connected session with the mic off: the user is typing. */
type AssistantStatus = "idle" | "connecting" | "ready" | "listening" | "thinking" | "speaking" | "error";
type ToolScopeRef = RefObject<HTMLDivElement | null>;

type Props = {
  toolId: string;
  toolLabel: string;
  toolRoot: ToolScopeRef;
  /** A question carried over from the landing page; it is sent as soon as the assistant mounts. */
  initialQuestion?: string;
};

type ChatMessage = { id: number; role: "user" | "assistant"; text: string };

type LiveMic = {
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  processor: AudioWorkletNode;
  inputMeter: AnalyserNode;
};

type LiveSession = {
  socket: WebSocket;
  audio: AudioContext;
  output: GainNode;
  outputMeter: AnalyserNode;
  /** The microphone, attached only while the user talks; a typed conversation has none. */
  mic: LiveMic | null;
  workletReady: boolean;
  /** Typed conversations read the reply instead of hearing it, unless the speaker is turned on. */
  muted: boolean;
  sources: Set<AudioBufferSourceNode>;
  scheduledAt: number;
  ready: boolean;
  turnFinished: boolean;
  userTurnStarted: boolean;
  ignoreContextUntil: number;
  contextTimer: ReturnType<typeof setTimeout> | null;
  setupTimer: ReturnType<typeof setTimeout> | null;
  intentionalClose: boolean;
};

type ControlCall = { name: string; id: string; args?: Record<string, unknown> };
type LiveMessage = {
  setupComplete?: unknown;
  serverContent?: {
    interimInputTranscription?: { text?: string };
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    modelTurn?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
    interrupted?: boolean;
    generationComplete?: boolean;
    turnComplete?: boolean;
  };
  toolCall?: { functionCalls?: ControlCall[] };
  goAway?: unknown;
};

const liveText = new TextDecoder();

/**
 * Indonesian by default. Without this, a short "hi" or an unclear first word made the model open in English.
 * Checked against the live model: greetings get Indonesian, a direct request or full English questions get English.
 */
const LANGUAGE_RULE = 'BAHASA: Selalu bicara dan menulis dalam Bahasa Indonesia, termasuk di awal percakapan. Sapaan atau kata pendek seperti "hi", "hello", "ok", "yes", atau suara yang tidak jelas BUKAN tanda pengguna ingin bahasa lain; tetap jawab dalam Bahasa Indonesia. Beralih ke Bahasa Inggris hanya jika pengguna memintanya secara langsung, atau terus bertanya dengan kalimat lengkap dalam Bahasa Inggris. Jangan pernah memakai bahasa selain Bahasa Indonesia dan Bahasa Inggris.';

const liveEndpoint =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

const toolDescriptions: Record<string, string> = {
  computer: "An interactive computer keyboard that shows what happens when you type.",
  rocket: "A rocket launch demo with selectable parts, engine power, and live flight readings.",
  engine: "A two-cylinder engine demo with moving pistons, valves, engine settings, and live readings.",
  "microscope-lab": "A laboratory microscope with selectable parts, lenses, focus, light, and a sample view.",
  typewriter: "A mechanical typewriter demo. Typing moves the keys and typebars and updates the line and column on the paper.",
  printer: "An FDM 3D printer. Pick an object, set print speed and nozzle temperature, start or pause the print, and open the exploded view to inspect each part.",
};

const toolFunctions = [
  {
    name: "inspect_tool_state",
    description: "Read the current tool, its live readings, selected parts, and control values before answering a question about the current state.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "activate_control",
    description: "Press one existing, enabled button in the active tool by its visible label. Use only when the user asks you to change the tool.",
    parameters: {
      type: "OBJECT",
      properties: { label: { type: "STRING", description: "The button label shown in the active tool." } },
      required: ["label"],
    },
  },
  {
    name: "adjust_control",
    description: "Set one existing range control in the active tool to a number within its displayed minimum and maximum. Use only when the user asks you to change the tool.",
    parameters: {
      type: "OBJECT",
      properties: {
        label: { type: "STRING", description: "The control label shown next to the slider." },
        value: { type: "NUMBER", description: "The requested value." },
      },
      required: ["label", "value"],
    },
  },
  {
    name: "set_toggle",
    description: "Turn one existing checkbox in the active tool on or off. Use only when the user asks you to change the tool.",
    parameters: {
      type: "OBJECT",
      properties: {
        label: { type: "STRING", description: "The checkbox label shown in the active tool." },
        value: { type: "BOOLEAN", description: "Whether the checkbox should be on." },
      },
      required: ["label", "value"],
    },
  },
];

function cleanName(element: HTMLElement) {
  return (
    element.getAttribute("aria-label") ||
    element.getAttribute("title") ||
    element.innerText?.replace(/\s+/g, " ").trim() ||
    element.textContent?.replace(/\s+/g, " ").trim() ||
    ""
  );
}

function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}%°µ.]+/gu, " ").trim();
}

function controlLabel(input: HTMLInputElement) {
  if (input.getAttribute("aria-label")) return input.getAttribute("aria-label")!;
  if (input.id) {
    const label = input.ownerDocument.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(input.id)}"]`);
    if (label) {
      const copy = label.cloneNode(true) as HTMLLabelElement;
      copy.querySelectorAll("output").forEach((output) => output.remove());
      return copy.innerText.replace(/\s+/g, " ").trim();
    }
  }
  const label = input.closest("label");
  if (!label) return "";
  const copy = label.cloneNode(true) as HTMLLabelElement;
  copy.querySelectorAll("output").forEach((output) => output.remove());
  return copy.innerText.replace(/\s+/g, " ").trim();
}

function readToolState(root: HTMLDivElement | null, toolId: string, toolLabel: string) {
  const tool = { id: toolId, name: toolLabel, description: toolDescriptions[toolId] ?? "An interactive Labscape tool." };
  if (!root) return { tool, status: "Loading tool state" };

  const readings = Object.fromEntries(
    [...root.querySelectorAll<HTMLElement>("[data-value]")]
      .filter((element) => element.dataset.value && !["announcement", "announce"].includes(element.dataset.value))
      .slice(0, 48)
      .map((element) => {
        const context = element.closest<HTMLElement>(
          ".engine-gauge, .engine-event-panel dl > div, .engine-opening, .engine-cycle-title, .engine-stepbar, .rocket-telemetry > div, .rocket-force > div, .rocket-stage-corner, .rocket-card-bottom",
        );
        const value = (context ?? element).innerText.replace(/\s+/g, " ").trim().slice(0, 220);
        return [element.dataset.value!, value];
      }),
  );
  const summaries = [...root.querySelectorAll<HTMLElement>(
    ".terminal-card-bottom, .ms-live-indicator, .ml-inspector, .ml-magnification, .ml-field-readouts, .ml-focus-visual, .tw-readout, .tw-note",
  )]
    .map((element) => element.innerText.replace(/\s+/g, " ").trim().slice(0, 700))
    .filter(Boolean)
    .slice(0, 8);
  const selected = [...root.querySelectorAll<HTMLElement>('[aria-pressed="true"]')]
    .map(cleanName)
    .filter(Boolean)
    .slice(0, 36);
  const controls = [...root.querySelectorAll<HTMLElement>("button:not(:disabled)")]
    .map(cleanName)
    .filter(Boolean)
    .slice(0, 60);
  const values = [...root.querySelectorAll<HTMLInputElement>('input[type="range"], input[type="checkbox"]')]
    .slice(0, 24)
    .map((input) => ({
      name: controlLabel(input),
      type: input.type,
      value: input.type === "checkbox" ? input.checked : Number(input.value),
      ...(input.type === "range" ? { min: Number(input.min), max: Number(input.max), step: Number(input.step || 1) } : {}),
    }))
    .filter((input) => input.name);
  const scene = root.querySelector<HTMLElement>(".iso, .tw");
  const flagNames = ["data-theme", "data-mode", "data-cutaway", "data-focus", "data-isolated", "data-highlight", "data-phase", "data-glass", "data-isolate"];
  const flags = Object.fromEntries(flagNames.flatMap((name) => {
    const value = scene?.getAttribute(name);
    return value === null || value === undefined ? [] : [[name.slice(5), value || true]];
  }));
  const activeControls = [...root.querySelectorAll<HTMLElement>(".tw-controls-row button.button--primary")]
    .map(cleanName)
    .filter(Boolean);

  return { tool, readings, summaries, selected, activeControls, flags, values, availableButtons: controls };
}

/**
 * Gemini streams transcripts in small pieces, and the space between two words usually leads the next
 * piece (" pertanyaan"), so pieces are joined as they come, never trimmed. A piece that repeats the
 * whole text so far (a cumulative update) replaces it, and a long piece sent twice is not doubled.
 */
function appendTranscript(previous: string, next: string) {
  const piece = next.replace(/\s+/g, " ");
  const core = piece.trim();
  const before = previous.trim();
  if (!core) return previous && !previous.endsWith(" ") ? `${previous} ` : previous;
  if (before.length >= 6 && core.length > before.length && core.startsWith(before)) return core;
  if (core.length >= 12 && before.endsWith(core)) return previous;
  return `${previous}${piece}`.replace(/ {2,}/g, " ").trimStart();
}

function base64(bytes: ArrayBuffer) {
  const data = new Uint8Array(bytes);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < data.length; index += chunkSize) {
    binary += String.fromCharCode(...data.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function stopPlayback(session: LiveSession) {
  for (const source of session.sources) {
    try {
      source.stop();
    } catch {
      // The source may already have ended.
    }
  }
  session.sources.clear();
  session.scheduledAt = session.audio.currentTime;
}

const levelBuffer = new Float32Array(1024);
function levelOf(meter: AnalyserNode) {
  meter.getFloatTimeDomainData(levelBuffer);
  let sum = 0;
  for (let index = 0; index < levelBuffer.length; index++) sum += levelBuffer[index] * levelBuffer[index];
  return Math.min(1, Math.sqrt(sum / levelBuffer.length) * 5);
}

type OrbLook = { speed: number; size: number; glow: number; hover: boolean; colors: string[] };
const ORB_COLORS = ["#2a86c0", "#5fae4f", "#0f3a55"];
const ORB_STYLE = { width: "100%", height: "100%" };
const ORB_ERROR = ["#e0645a", "#f09a6b", "#7a1f1a"];

function orbLook(status: AssistantStatus, level: number): OrbLook {
  switch (status) {
    case "ready": return { speed: 0.9, size: 0.88, glow: 1.3, hover: true, colors: ORB_COLORS };
    case "connecting": return { speed: 2.4, size: 0.86, glow: 1.1, hover: true, colors: ORB_COLORS };
    case "listening": return { speed: 1.1 + level * 2, size: 0.9 + level * 0.22, glow: 1.1 + level, hover: true, colors: ORB_COLORS };
    case "thinking": return { speed: 2.8, size: 0.88, glow: 1.3, hover: true, colors: ORB_COLORS };
    case "speaking": return { speed: 1.6 + level * 3, size: 0.92 + level * 0.28, glow: 1.3 + level * 1.6, hover: true, colors: ORB_COLORS };
    case "error": return { speed: 0.6, size: 0.86, glow: 1, hover: false, colors: ORB_ERROR };
    default: return { speed: 0.7, size: 0.88, glow: 1.4, hover: false, colors: ORB_COLORS };
  }
}

/** React Bits' Orb, driven by the session: its state picks the mood, the live mic or voice level swells it. */
function VoiceOrb({ status, levelOf }: { status: AssistantStatus; levelOf: () => number }) {
  const [level, setLevel] = useState(0);
  const live = status === "listening" || status === "speaking";
  useEffect(() => {
    if (!live) return;
    let smooth = 0;
    const timer = setInterval(() => {
      smooth += (levelOf() - smooth) * 0.45;
      setLevel(Math.round(smooth * 50) / 50);
    }, 60);
    return () => clearInterval(timer);
  }, [live, levelOf]);
  const look = orbLook(status, live ? level : 0);
  return (
    <Orb
      colors={look.colors}
      backgroundColor="#ffffff"
      speed={look.speed}
      size={look.size}
      glow={look.glow}
      forceHoverState={look.hover}
      hoverIntensity={0.8}
      followCursor
      clickPulse
      dpr={1.5}
      style={ORB_STYLE}
    />
  );
}

function detachMic(session: LiveSession) {
  const mic = session.mic;
  if (!mic) return;
  session.mic = null;
  mic.processor.port.onmessage = null;
  mic.source.disconnect();
  mic.processor.disconnect();
  mic.stream.getTracks().forEach((track) => track.stop());
}

function cleanup(session: LiveSession) {
  session.intentionalClose = true;
  if (session.contextTimer) clearTimeout(session.contextTimer);
  if (session.setupTimer) clearTimeout(session.setupTimer);
  stopPlayback(session);
  detachMic(session);
  session.output.disconnect();
  session.outputMeter.disconnect();
  if (session.socket.readyState < WebSocket.CLOSING) session.socket.close();
  if (session.audio.state !== "closed") void session.audio.close();
}

function matchLabel(query: string, candidates: HTMLElement[], getName = cleanName) {
  const target = normalize(query);
  if (!target) return null;
  const matches = candidates.filter((element) => {
    const name = normalize(getName(element));
    return Boolean(name) && (name === target || name.includes(target) || target.includes(name));
  });
  return matches.length === 1 ? matches[0] : null;
}

const DOCK_KEY = "labscape.assistant.position";
const DRAG_SLOP = 5;
const EDGE = 8;

type DockPlace = { x: number; y: number };

/**
 * Lets the floating assistant be dragged anywhere on screen. The position is kept per browser,
 * clamped to the viewport, and the bubble and label flip to whichever side has room.
 */
function useDraggableDock() {
  const rootRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const dragged = useRef(false);

  const place = useCallback((next: DockPlace | null, save = false) => {
    const root = rootRef.current;
    const handle = handleRef.current;
    if (!root || !handle) return;
    if (!next) {
      root.style.removeProperty("left");
      root.style.removeProperty("top");
      delete root.dataset.placed;
    } else {
      // Clamp by the orb itself so the label can never push it off screen.
      const orb = handle.getBoundingClientRect();
      const box = root.getBoundingClientRect();
      const offsetX = orb.left - box.left;
      const offsetY = orb.top - box.top;
      const x = Math.min(Math.max(next.x, EDGE), window.innerWidth - orb.width - EDGE);
      const y = Math.min(Math.max(next.y, EDGE), window.innerHeight - orb.height - EDGE);
      root.dataset.placed = "";
      root.style.left = `${x - offsetX}px`;
      root.style.top = `${y - offsetY}px`;
      next = { x, y };
    }
    const orb = handle.getBoundingClientRect();
    root.dataset.vertical = orb.top + orb.height / 2 < window.innerHeight * 0.45 ? "top" : "bottom";
    root.dataset.horizontal = orb.left + orb.width / 2 < window.innerWidth * 0.5 ? "left" : "right";
    if (save) {
      try {
        if (next) localStorage.setItem(DOCK_KEY, JSON.stringify(next));
        else localStorage.removeItem(DOCK_KEY);
      } catch {
        // Storage can be unavailable (private mode); the position just won't persist.
      }
    }
  }, []);

  const current = useCallback((): DockPlace | null => {
    const handle = handleRef.current;
    if (!handle || rootRef.current?.dataset.placed === undefined) return null;
    const orb = handle.getBoundingClientRect();
    return { x: orb.left, y: orb.top };
  }, []);

  useEffect(() => {
    let saved: DockPlace | null = null;
    try {
      const raw = localStorage.getItem(DOCK_KEY);
      if (raw) saved = JSON.parse(raw) as DockPlace;
    } catch {
      saved = null;
    }
    place(saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? saved : null);
    const onResize = () => place(current());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [current, place]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const handle = event.currentTarget;
    const start = handle.getBoundingClientRect();
    const fromX = event.clientX;
    const fromY = event.clientY;
    let moving = false;
    dragged.current = false;
    // Capture on press so a fast flick that leaves the orb still drags it.
    handle.setPointerCapture(event.pointerId);

    const move = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - fromX;
      const dy = moveEvent.clientY - fromY;
      if (!moving && Math.hypot(dx, dy) < DRAG_SLOP) return;
      if (!moving) {
        moving = true;
        dragged.current = true;
        rootRef.current?.setAttribute("data-dragging", "");
      }
      place({ x: start.left + dx, y: start.top + dy });
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      rootRef.current?.removeAttribute("data-dragging");
      if (moving) place(current(), true);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }, [current, place]);

  /** A drag ends with a click on the same button; swallow it so dragging never toggles the session. */
  const consumeDrag = useCallback(() => {
    const was = dragged.current;
    dragged.current = false;
    return was;
  }, []);

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!step || !event.shiftKey) return;
    event.preventDefault();
    const orb = event.currentTarget.getBoundingClientRect();
    place({ x: orb.left + step[0] * 32, y: orb.top + step[1] * 32 }, true);
  }, [place]);

  const reset = useCallback(() => place(null, true), [place]);

  return { rootRef, handleRef, onPointerDown, onKeyDown, consumeDrag, reset };
}

export function LiveAssistant({ toolId, toolLabel, toolRoot, initialQuestion }: Props) {
  const [status, setStatus] = useState<AssistantStatus>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState("");
  const sessionRef = useRef<LiveSession | null>(null);
  const toolRef = useRef({ id: toolId, label: toolLabel, root: toolRoot });
  const connectRef = useRef(false);
  const cancelConnectRef = useRef(false);
  const connectAbortRef = useRef<AbortController | null>(null);
  /** Typed messages waiting for the session to finish connecting. */
  const pendingRef = useRef<string[]>([]);
  /** Whether the last user / assistant message is still being transcribed. */
  const openTurn = useRef({ user: false, assistant: false });
  const messageId = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { rootRef: dockRootRef, handleRef: dockHandleRef, onPointerDown: onDockPointerDown, onKeyDown: onDockKeyDown, consumeDrag, reset: resetDock } = useDraggableDock();

  useEffect(() => {
    toolRef.current = { id: toolId, label: toolLabel, root: toolRoot };
  }, [toolId, toolLabel, toolRoot]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, error]);

  const stateSnapshot = useCallback(() => {
    const current = toolRef.current;
    return readToolState(current.root.current, current.id, current.label);
  }, []);

  /** Adds a transcript piece to the open message of that role, or starts a new message. */
  const appendLive = useCallback((role: ChatMessage["role"], piece: string) => {
    const open = openTurn.current[role];
    openTurn.current[role] = true;
    setMessages((list) => {
      const last = list.at(-1);
      if (open && last?.role === role) return [...list.slice(0, -1), { ...last, text: appendTranscript(last.text, piece) }];
      return [...list, { id: ++messageId.current, role, text: appendTranscript("", piece) }];
    });
  }, []);

  const idleStatus = (session: LiveSession): AssistantStatus => (session.mic ? "listening" : "ready");

  const sendState = useCallback((session: LiveSession, turnComplete = false) => {
    if (!session.ready || session.socket.readyState !== WebSocket.OPEN) return;
    const current = toolRef.current;
    const content = {
      activeTool: current.label,
      currentState: readToolState(current.root.current, current.id, current.label),
    };
    session.socket.send(JSON.stringify({
      clientContent: {
        turns: [{ role: "user", parts: [{ text: `TOOL STATE UPDATE (context only; do not answer this message): ${JSON.stringify(content)}` }] }],
        turnComplete,
      },
    }));
  }, []);

  const deliverText = useCallback((session: LiveSession, text: string) => {
    session.socket.send(JSON.stringify({
      clientContent: { turns: [{ role: "user", parts: [{ text }] }], turnComplete: true },
    }));
    session.turnFinished = false;
    setStatus("thinking");
  }, []);

  const closeSession = useCallback((nextStatus: AssistantStatus = "idle") => {
    const current = sessionRef.current;
    sessionRef.current = null;
    pendingRef.current = [];
    if (current) cleanup(current);
    setMicOn(false);
    setStatus(nextStatus);
  }, []);

  const sendAudio = useCallback((session: LiveSession, pcm: ArrayBuffer) => {
    if (!session.ready || session.socket.readyState !== WebSocket.OPEN) return;
    session.socket.send(JSON.stringify({
      realtimeInput: { audio: { mimeType: "audio/pcm;rate=16000", data: base64(pcm) } },
    }));
  }, []);

  const playAudio = useCallback((session: LiveSession, data: string, mimeType: string) => {
    if (session.muted) return;
    const raw = atob(data);
    const pcm = new DataView(new ArrayBuffer(raw.length));
    for (let index = 0; index < raw.length; index++) pcm.setUint8(index, raw.charCodeAt(index));
    const sampleRate = Number(mimeType.match(/rate=(\d+)/)?.[1] ?? 24000);
    const samples = new Float32Array(Math.floor(raw.length / 2));
    for (let index = 0; index < samples.length; index++) samples[index] = pcm.getInt16(index * 2, true) / 32768;
    const audioBuffer = session.audio.createBuffer(1, samples.length, sampleRate);
    audioBuffer.copyToChannel(samples, 0);

    const source = session.audio.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(session.output);
    const startsAt = Math.max(session.audio.currentTime + 0.015, session.scheduledAt);
    session.scheduledAt = startsAt + audioBuffer.duration;
    session.sources.add(source);
    source.onended = () => {
      session.sources.delete(source);
      if (sessionRef.current === session && session.turnFinished && session.sources.size === 0) {
        setStatus(idleStatus(session));
      }
    };
    session.turnFinished = false;
    source.start(startsAt);
    setStatus("speaking");
  }, []);

  /** Turns the microphone on inside an open session, so a typed conversation can carry on by voice. */
  const attachMic = useCallback(async (session: LiveSession) => {
    if (session.mic) return;
    if (!navigator.mediaDevices?.getUserMedia || !("audioWorklet" in AudioContext.prototype)) {
      throw new Error("Peramban ini belum mendukung percakapan suara.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    if (sessionRef.current !== session) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    await session.audio.resume();
    if (!session.workletReady) {
      await session.audio.audioWorklet.addModule("/audio/gemini-pcm-worklet.js");
      session.workletReady = true;
    }
    const source = session.audio.createMediaStreamSource(stream);
    const inputMeter = session.audio.createAnalyser();
    const processor = new AudioWorkletNode(session.audio, "gemini-pcm-capture");
    source.connect(inputMeter);
    processor.port.onmessage = (event: MessageEvent<ArrayBuffer>) => sendAudio(session, event.data);
    session.mic = { stream, source, processor, inputMeter };
    if (session.ready) {
      source.connect(processor);
      processor.connect(session.audio.destination);
      setStatus("listening");
    }
    // Talking means listening for a spoken answer.
    session.muted = false;
    setMuted(false);
    setMicOn(true);
  }, [sendAudio]);

  const dropMic = useCallback((session: LiveSession) => {
    detachMic(session);
    setMicOn(false);
    if (session.ready && session.sources.size === 0) setStatus("ready");
  }, []);

  const runControlCall = useCallback(async (call: ControlCall) => {
    if (call.name === "inspect_tool_state") return { ok: true, state: stateSnapshot() };
    const root = toolRef.current.root.current;
    const label = typeof call.args?.label === "string" ? call.args.label : "";
    if (!root || !label) return { ok: false, message: "The active control could not be found." };

    const session = sessionRef.current;
    if (session) session.ignoreContextUntil = Date.now() + 1000;

    if (call.name === "activate_control") {
      const button = matchLabel(label, [...root.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")]);
      if (!button) return { ok: false, message: "There is no single enabled button with that label in the active tool." };
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 90));
      return { ok: true, action: cleanName(button), state: stateSnapshot() };
    }

    if (call.name === "adjust_control") {
      const input = matchLabel(
        label,
        [...root.querySelectorAll<HTMLInputElement>('input[type="range"]')],
        (element) => controlLabel(element as HTMLInputElement),
      ) as HTMLInputElement | null;
      const value = typeof call.args?.value === "number" ? call.args.value : Number.NaN;
      if (!input || !Number.isFinite(value)) return { ok: false, message: "That range control or number could not be matched." };
      const min = Number(input.min || 0);
      const max = Number(input.max || 100);
      const step = Number(input.step || 1);
      const clamped = Math.min(max, Math.max(min, value));
      const stepped = min + Math.round((clamped - min) / step) * step;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, String(Math.min(max, Math.max(min, stepped))));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 90));
      return { ok: true, action: controlLabel(input), value: input.value, state: stateSnapshot() };
    }

    if (call.name === "set_toggle") {
      const input = matchLabel(
        label,
        [...root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')],
        (element) => controlLabel(element as HTMLInputElement),
      ) as HTMLInputElement | null;
      const value = typeof call.args?.value === "boolean" ? call.args.value : null;
      if (!input || value === null) return { ok: false, message: "That checkbox could not be matched." };
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 90));
      return { ok: true, action: controlLabel(input), value: input.checked, state: stateSnapshot() };
    }

    return { ok: false, message: "This tool action is not available." };
  }, [stateSnapshot]);

  const handleToolCalls = useCallback(async (calls: ControlCall[]) => {
    const session = sessionRef.current;
    if (!session || session.socket.readyState !== WebSocket.OPEN) return;
    const functionResponses = [];
    for (const call of calls) {
      const result = await runControlCall(call);
      functionResponses.push({ name: call.name, id: call.id, response: { result } });
    }
    if (session.socket.readyState === WebSocket.OPEN) {
      session.socket.send(JSON.stringify({ toolResponse: { functionResponses } }));
    }
  }, [runControlCall]);

  const connect = useCallback(async (mode: "voice" | "text") => {
    if (connectRef.current || sessionRef.current) return;
    connectRef.current = true;
    cancelConnectRef.current = false;
    const controller = new AbortController();
    connectAbortRef.current = controller;
    setError("");
    setStatus("connecting");
    openTurn.current = { user: false, assistant: false };

    let audio: AudioContext | null = null;
    let socket: WebSocket | null = null;
    let session: LiveSession | null = null;
    try {
      const tokenResponse = await fetch("/api/live/token", { method: "POST", cache: "no-store", signal: controller.signal });
      if (!tokenResponse.ok) {
        if (tokenResponse.status === 503) throw new Error("Asisten belum disiapkan.");
        if (tokenResponse.status === 429) throw new Error("Tunggu sebentar lalu coba lagi.");
        throw new Error("Asisten sedang tidak tersedia. Coba lagi nanti.");
      }
      const credentials = await tokenResponse.json() as { token?: string; model?: string };
      if (!credentials.token || !credentials.model) throw new Error("Asisten sedang tidak tersedia.");
      if (cancelConnectRef.current) return;

      audio = new AudioContext();
      // Outside a click (a question from the landing page) the context may stay suspended; text still works.
      void audio.resume().catch(() => undefined);
      socket = new WebSocket(`${liveEndpoint}?access_token=${encodeURIComponent(credentials.token)}`);
      // Gemini Live sends its JSON messages as binary frames.
      socket.binaryType = "arraybuffer";

      const live: LiveSession = {
        socket,
        audio,
        output: audio.createGain(),
        outputMeter: audio.createAnalyser(),
        mic: null,
        workletReady: false,
        muted: mode === "text",
        sources: new Set(),
        scheduledAt: audio.currentTime,
        ready: false,
        turnFinished: false,
        userTurnStarted: false,
        ignoreContextUntil: 0,
        contextTimer: null,
        setupTimer: null,
        intentionalClose: false,
      };
      session = live;
      live.output.connect(live.outputMeter);
      live.outputMeter.connect(audio.destination);
      sessionRef.current = live;
      setMuted(live.muted);
      live.setupTimer = setTimeout(() => {
        if (sessionRef.current === live && !live.ready) {
          setError("Sambungan terlalu lama. Coba lagi.");
          closeSession("error");
        }
      }, 20000);

      socket.onopen = () => {
        const current = toolRef.current;
        const initialState = readToolState(current.root.current, current.id, current.label);
        const otherTools = toolCatalog.filter((tool) => tool.id !== current.id).map((tool) => `${tool.label}: ${tool.blurb}`).join(" ");
        live.socket.send(JSON.stringify({
          setup: {
            model: `models/${credentials.model}`,
            generationConfig: { responseModalities: ["AUDIO"] },
            inputAudioTranscription: { languageCodes: ["id-ID", "en-US"] },
            outputAudioTranscription: { languageCodes: ["id-ID", "en-US"] },
            systemInstruction: {
              parts: [{ text: `Kamu adalah Labscape AI, asisten belajar untuk alat interaktif Labscape. Pengguna bisa berbicara atau mengetik; jawabanmu juga ditampilkan sebagai teks. Jawab singkat dan santai. ${LANGUAGE_RULE} Kamu memahami satu alat aktif berikut beserta kondisinya. Jika pertanyaan merujuk pada isi alat yang berubah, pilihan aktif, atau angka saat ini, panggil inspect_tool_state sebelum menjawab. Aksi kontrol hanya dilakukan jika pengguna memintanya dengan jelas. Gunakan label tombol, slider, dan sakelar persis seperti yang tersedia. Jangan mengaku mengubah sesuatu jika aksi gagal. Jelaskan alat dengan bahasa mudah, bukan jargon teknis kecuali pengguna memintanya. Jika pertanyaan lebih cocok dengan alat lain, jawab singkat lalu sarankan pengguna membuka alat itu dari menu Tool. Alat lain yang tersedia: ${otherTools}\n\nALAT DAN KONDISI AWAL:\n${JSON.stringify({ tool: { id: current.id, name: current.label, description: toolDescriptions[current.id] }, state: initialState })}` }],
            },
            tools: [{ functionDeclarations: toolFunctions }],
          },
        }));
      };

      socket.onmessage = (event) => {
        let message: LiveMessage;
        try {
          const text = typeof event.data === "string" ? event.data : liveText.decode(event.data as ArrayBuffer);
          message = JSON.parse(text) as LiveMessage;
        } catch {
          return;
        }

        if (message.setupComplete) {
          if (live.setupTimer) clearTimeout(live.setupTimer);
          live.ready = true;
          if (live.mic) {
            live.mic.source.connect(live.mic.processor);
            live.mic.processor.connect(live.audio.destination);
          }
          sendState(live);
          setStatus(idleStatus(live));
          const queued = pendingRef.current;
          pendingRef.current = [];
          for (const text of queued) deliverText(live, text);
        }

        const content = message.serverContent;
        const interimText = content?.interimInputTranscription?.text;
        const inputText = content?.inputTranscription?.text;
        const outputText = content?.outputTranscription?.text;
        if (interimText || inputText) {
          if (!live.userTurnStarted) {
            live.userTurnStarted = true;
            live.turnFinished = false;
            openTurn.current.assistant = false;
          }
        }
        if (interimText) appendLive("user", interimText);
        if (inputText) {
          appendLive("user", inputText);
          setStatus("thinking");
        }
        if (outputText) {
          openTurn.current.user = false;
          appendLive("assistant", outputText);
          if (!live.turnFinished || live.sources.size > 0) setStatus("speaking");
        }
        if (content?.modelTurn?.parts) {
          for (const part of content.modelTurn.parts) {
            if (part.inlineData?.data) playAudio(live, part.inlineData.data, part.inlineData.mimeType ?? "audio/pcm;rate=24000");
          }
        }
        if (content?.interrupted) {
          stopPlayback(live);
          live.turnFinished = false;
          openTurn.current.assistant = false;
          setStatus(idleStatus(live));
        }
        // The reply is fully generated well before turnComplete arrives; once nothing is left to play,
        // the assistant is ready again. The transcript stays open until turnComplete in case text trails.
        if (content?.generationComplete) {
          live.turnFinished = true;
          if (live.sources.size === 0) setStatus(idleStatus(live));
        }
        if (content?.turnComplete) {
          live.turnFinished = true;
          live.userTurnStarted = false;
          openTurn.current = { user: false, assistant: false };
          if (live.sources.size === 0) setStatus(idleStatus(live));
        }
        if (message.toolCall?.functionCalls) {
          void handleToolCalls(message.toolCall.functionCalls);
        }
        if (message.goAway && sessionRef.current === live) {
          setError("Sesi akan berakhir. Mulai lagi untuk melanjutkan.");
        }
      };

      socket.onerror = () => {
        if (sessionRef.current !== live) return;
        setError("Sambungan terputus. Coba lagi.");
        closeSession("error");
      };
      socket.onclose = (event) => {
        if (sessionRef.current !== live || live.intentionalClose) return;
        if (event.reason) console.warn(`Gemini Live closed (${event.code}): ${event.reason}`);
        setError(live.ready
          ? "Sambungan berakhir. Kirim pesan atau tekan orb untuk mulai lagi."
          : `Gemini menolak sambungan${event.reason ? `: ${event.reason}` : ` (kode ${event.code})`}.`);
        closeSession("error");
      };

      if (mode === "voice") await attachMic(live);
    } catch (reason) {
      if (session && sessionRef.current === session) closeSession("idle");
      else {
        if (audio && audio.state !== "closed") void audio.close();
        if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
      }
      if (cancelConnectRef.current) return;
      const errorName = reason instanceof DOMException ? reason.name : "";
      const message = errorName === "NotAllowedError"
        ? "Izinkan akses mikrofon untuk berbicara, atau ketik saja pertanyaanmu."
        : errorName === "NotFoundError"
          ? "Mikrofon tidak ditemukan. Kamu tetap bisa mengetik."
          : reason instanceof Error
            ? reason.message
            : "Asisten sedang tidak tersedia. Coba lagi nanti.";
      setError(message);
      setStatus("error");
    } finally {
      connectRef.current = false;
      if (connectAbortRef.current === controller) connectAbortRef.current = null;
    }
  }, [appendLive, attachMic, closeSession, deliverText, handleToolCalls, playAudio, sendState]);

  /** Sends a typed message, connecting a text session first when none is open. */
  const sendText = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text) return;
    setPanelOpen(true);
    setError("");
    openTurn.current = { user: false, assistant: false };
    setMessages((list) => [...list, { id: ++messageId.current, role: "user", text }]);
    const session = sessionRef.current;
    if (session?.ready && session.socket.readyState === WebSocket.OPEN) deliverText(session, text);
    else {
      pendingRef.current.push(text);
      if (!session) void connect("text");
    }
  }, [connect, deliverText]);

  /** The orb: starts a voice conversation, or turns the mic on and off inside the current one. */
  const toggleVoice = useCallback(() => {
    const session = sessionRef.current;
    setPanelOpen(true);
    if (session) {
      if (session.mic) dropMic(session);
      else {
        setError("");
        attachMic(session).catch((reason: unknown) => {
          const name = reason instanceof DOMException ? reason.name : "";
          setError(name === "NotAllowedError" ? "Izinkan akses mikrofon untuk berbicara, atau ketik saja pertanyaanmu." : reason instanceof Error ? reason.message : "Mikrofon tidak bisa dipakai.");
        });
      }
    } else if (connectRef.current) {
      cancelConnectRef.current = true;
      connectAbortRef.current?.abort();
      setStatus("idle");
      setError("");
    } else {
      void connect("voice");
    }
  }, [attachMic, connect, dropMic]);

  const endConversation = useCallback(() => {
    if (connectRef.current) {
      cancelConnectRef.current = true;
      connectAbortRef.current?.abort();
    }
    closeSession("idle");
    setMessages([]);
    setError("");
    setPanelOpen(false);
  }, [closeSession]);

  const toggleSpeaker = useCallback(() => {
    const session = sessionRef.current;
    const next = !muted;
    setMuted(next);
    if (!session) return;
    session.muted = next;
    if (next) {
      stopPlayback(session);
      if (session.ready) setStatus(idleStatus(session));
    } else void session.audio.resume().catch(() => undefined);
  }, [muted]);

  // A question typed on the landing page opens the chat and goes straight to the assistant.
  // Deferred a tick so React's development double-mount only sends it once.
  const askedRef = useRef(false);
  useEffect(() => {
    if (!initialQuestion || askedRef.current) return;
    const timer = setTimeout(() => {
      askedRef.current = true;
      sendText(initialQuestion);
    }, 0);
    return () => clearTimeout(timer);
  }, [initialQuestion, sendText]);

  useEffect(() => {
    const root = toolRoot.current;
    if (!root) return;

    const onToolInteraction = () => {
      const session = sessionRef.current;
      if (!session || !session.ready || Date.now() < session.ignoreContextUntil) return;
      if (session.contextTimer) clearTimeout(session.contextTimer);
      session.contextTimer = setTimeout(() => sendState(session), 280);
    };
    root.addEventListener("click", onToolInteraction, true);
    root.addEventListener("change", onToolInteraction, true);
    root.addEventListener("keydown", onToolInteraction, true);
    return () => {
      root.removeEventListener("click", onToolInteraction, true);
      root.removeEventListener("change", onToolInteraction, true);
      root.removeEventListener("keydown", onToolInteraction, true);
    };
  }, [toolId, sendState, toolRoot]);

  useEffect(() => {
    const session = sessionRef.current;
    if (session?.ready) sendState(session);
  }, [toolId, toolLabel, sendState]);

  useEffect(() => () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) cleanup(session);
  }, []);

  const readLevel = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return 0;
    return Math.max(session.mic ? levelOf(session.mic.inputMeter) : 0, levelOf(session.outputMeter));
  }, []);

  const connected = status !== "idle" && status !== "error";
  const statusLabel = {
    idle: "Ketik atau bicara",
    connecting: "Menghubungkan",
    ready: "Siap",
    listening: "Mendengarkan",
    thinking: "Sebentar ya",
    speaking: muted ? "Menjawab" : "Sedang bicara",
    error: "Ada kendala",
  }[status];

  return (
    <div ref={dockRootRef} className="svg-assistant" data-active={panelOpen || connected} data-status={status} data-speaking={status === "speaking"} data-error={status === "error"}>
      {panelOpen && (
        <section className="svg-assistant-bubble svg-assistant-chat" aria-label="Percakapan dengan Labscape AI">
          <div className="svg-assistant-bubble-top">
            <span className="svg-assistant-orb" aria-hidden="true"><i /><i /><i /></span>
            <span>{statusLabel}</span>
            <span className="svg-assistant-tool">{toolLabel}</span>
            <button type="button" className="svg-assistant-icon" onClick={toggleSpeaker} aria-pressed={!muted} aria-label={muted ? "Bacakan jawaban" : "Matikan suara jawaban"} title={muted ? "Bacakan jawaban" : "Matikan suara jawaban"}>
              {muted ? <VolumeX size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}
            </button>
            <button type="button" className="svg-assistant-icon" onClick={endConversation} aria-label="Tutup dan akhiri percakapan" title="Tutup dan akhiri percakapan">
              <X size={15} aria-hidden="true" />
            </button>
          </div>
          <div ref={listRef} className="svg-assistant-log" aria-live="polite">
            {messages.length === 0 && !error && (
              <p className="svg-assistant-empty">Tanya apa saja tentang {toolLabel}. Ketik di bawah, atau tekan orb untuk bicara.</p>
            )}
            {messages.map((message) => (
              <p key={message.id} className="svg-assistant-message" data-role={message.role}>{message.text}</p>
            ))}
            {status === "thinking" && messages.at(-1)?.role === "user" && (
              <p className="svg-assistant-message svg-assistant-typing" data-role="assistant" aria-label="Sedang menyiapkan jawaban"><i /><i /><i /></p>
            )}
            {error && <p className="svg-assistant-error">{error}</p>}
          </div>
          <form
            className="svg-assistant-compose"
            onSubmit={(event) => {
              event.preventDefault();
              sendText(draft);
              setDraft("");
            }}
          >
            <button type="button" className="svg-assistant-icon" data-on={micOn} onClick={toggleVoice} aria-pressed={micOn} aria-label={micOn ? "Matikan mikrofon" : "Bicara"} title={micOn ? "Matikan mikrofon" : "Bicara"}>
              {micOn ? <Mic size={16} aria-hidden="true" /> : <MicOff size={16} aria-hidden="true" />}
            </button>
            <label className="svg-assistant-sr" htmlFor="svg-assistant-input">Pesan untuk Labscape AI</label>
            <input
              ref={inputRef}
              id="svg-assistant-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={micOn ? "Bicara, atau ketik di sini…" : `Tanya tentang ${toolLabel}…`}
              autoComplete="off"
              maxLength={500}
            />
            <button type="submit" className="svg-assistant-send" disabled={!draft.trim()} aria-label="Kirim">
              <ArrowUp size={16} aria-hidden="true" />
            </button>
          </form>
        </section>
      )}
      <div className="svg-assistant-dock">
        {!panelOpen && (
          <button type="button" className="svg-assistant-hint" onClick={() => { setPanelOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}>
            Labscape AI
          </button>
        )}
        <button
          ref={dockHandleRef}
          className="svg-assistant-orb-button"
          type="button"
          onClick={() => { if (!consumeDrag()) toggleVoice(); }}
          onPointerDown={onDockPointerDown}
          onKeyDown={onDockKeyDown}
          onDoubleClick={resetDock}
          aria-label={micOn ? "Matikan mikrofon" : "Bicara dengan Labscape AI"}
          aria-describedby="svg-assistant-drag-hint"
          aria-pressed={micOn}
          title={micOn ? "Matikan mikrofon · seret untuk memindahkan" : "Bicara · seret untuk memindahkan"}
        >
          <VoiceOrb status={status} levelOf={readLevel} />
        </button>
      </div>
      <span className="svg-assistant-sr" role="status">{error}</span>
      <span className="svg-assistant-sr" id="svg-assistant-drag-hint">Seret, atau tekan Shift dan tombol panah, untuk memindahkan. Klik dua kali untuk mengembalikan ke pojok.</span>
    </div>
  );
}
