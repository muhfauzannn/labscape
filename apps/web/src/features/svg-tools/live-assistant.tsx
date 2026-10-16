"use client";

import { Mic, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

type AssistantStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";
type ToolScopeRef = RefObject<HTMLDivElement | null>;

type Props = {
  toolId: string;
  toolLabel: string;
  toolRoot: ToolScopeRef;
};

type LiveSession = {
  socket: WebSocket;
  stream: MediaStream;
  audio: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: AudioWorkletNode;
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
    turnComplete?: boolean;
  };
  toolCall?: { functionCalls?: ControlCall[] };
  goAway?: unknown;
};

const liveEndpoint =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

const toolDescriptions: Record<string, string> = {
  microscope: "A microscope cutaway that shows how light travels through the lenses.",
  computer: "An interactive computer keyboard that shows what happens when you type.",
  rocket: "A rocket launch demo with selectable parts, engine power, and live flight readings.",
  engine: "A two-cylinder engine demo with moving pistons, valves, engine settings, and live readings.",
  "microscope-lab": "A laboratory microscope with selectable parts, lenses, focus, light, and a sample view.",
  typewriter: "A mechanical typewriter demo. Typing moves the keys and typebars and updates the line and column on the paper.",
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
  const tool = { id: toolId, name: toolLabel, description: toolDescriptions[toolId] ?? "An interactive Labai tool." };
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

function appendTranscript(previous: string, next: string) {
  const text = next.trim();
  if (!text) return previous;
  if (text.startsWith(previous)) return text;
  if (previous.endsWith(text)) return previous;
  return `${previous}${text}`.replace(/\s+/g, " ").trim();
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

function cleanup(session: LiveSession) {
  session.intentionalClose = true;
  if (session.contextTimer) clearTimeout(session.contextTimer);
  if (session.setupTimer) clearTimeout(session.setupTimer);
  stopPlayback(session);
  session.processor.port.onmessage = null;
  session.source.disconnect();
  session.processor.disconnect();
  session.stream.getTracks().forEach((track) => track.stop());
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

export function LiveAssistant({ toolId, toolLabel, toolRoot }: Props) {
  const [status, setStatus] = useState<AssistantStatus>("idle");
  const [assistantText, setAssistantText] = useState("");
  const [userText, setUserText] = useState("");
  const [error, setError] = useState("");
  const sessionRef = useRef<LiveSession | null>(null);
  const toolRef = useRef({ id: toolId, label: toolLabel, root: toolRoot });
  const connectRef = useRef(false);
  const cancelConnectRef = useRef(false);
  const connectAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    toolRef.current = { id: toolId, label: toolLabel, root: toolRoot };
  }, [toolId, toolLabel, toolRoot]);

  const stateSnapshot = useCallback(() => {
    const current = toolRef.current;
    return readToolState(current.root.current, current.id, current.label);
  }, []);

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

  const closeSession = useCallback((nextStatus: AssistantStatus = "idle") => {
    const current = sessionRef.current;
    sessionRef.current = null;
    if (current) cleanup(current);
    setStatus(nextStatus);
  }, []);

  const sendAudio = useCallback((session: LiveSession, pcm: ArrayBuffer) => {
    if (!session.ready || session.socket.readyState !== WebSocket.OPEN) return;
    session.socket.send(JSON.stringify({
      realtimeInput: { audio: { mimeType: "audio/pcm;rate=16000", data: base64(pcm) } },
    }));
  }, []);

  const playAudio = useCallback((session: LiveSession, data: string, mimeType: string) => {
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
    source.connect(session.audio.destination);
    const startsAt = Math.max(session.audio.currentTime + 0.015, session.scheduledAt);
    session.scheduledAt = startsAt + audioBuffer.duration;
    session.sources.add(source);
    source.onended = () => {
      session.sources.delete(source);
      if (sessionRef.current === session && session.turnFinished && session.sources.size === 0) {
        setStatus("listening");
      }
    };
    session.turnFinished = false;
    source.start(startsAt);
    setStatus("speaking");
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

  const startSession = useCallback(async () => {
    if (connectRef.current || sessionRef.current) return;
    connectRef.current = true;
    cancelConnectRef.current = false;
    const controller = new AbortController();
    connectAbortRef.current = controller;
    setError("");
    setAssistantText("");
    setUserText("");
    setStatus("connecting");

    let stream: MediaStream | null = null;
    let audio: AudioContext | null = null;
    let socket: WebSocket | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !("audioWorklet" in AudioContext.prototype)) {
        throw new Error("Peramban ini belum mendukung percakapan suara.");
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (cancelConnectRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const tokenResponse = await fetch("/api/live/token", { method: "POST", cache: "no-store", signal: controller.signal });
      if (!tokenResponse.ok) {
        if (tokenResponse.status === 503) throw new Error("Asisten suara belum disiapkan.");
        if (tokenResponse.status === 429) throw new Error("Tunggu sebentar lalu coba lagi.");
        throw new Error("Asisten suara sedang tidak tersedia. Coba lagi nanti.");
      }
      const credentials = await tokenResponse.json() as { token?: string; model?: string };
      if (!credentials.token || !credentials.model) throw new Error("Asisten suara sedang tidak tersedia.");
      if (cancelConnectRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      audio = new AudioContext();
      await audio.resume();
      await audio.audioWorklet.addModule("/audio/gemini-pcm-worklet.js");
      if (cancelConnectRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        void audio.close();
        return;
      }
      socket = new WebSocket(`${liveEndpoint}?access_token=${encodeURIComponent(credentials.token)}`);

      const session: LiveSession = {
        socket,
        stream,
        audio,
        source: audio.createMediaStreamSource(stream),
        processor: new AudioWorkletNode(audio, "gemini-pcm-capture"),
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
      sessionRef.current = session;
      session.setupTimer = setTimeout(() => {
        if (sessionRef.current === session && !session.ready) {
          setError("Sambungan suara terlalu lama. Coba lagi.");
          closeSession("error");
        }
      }, 20000);

      session.processor.port.onmessage = (event: MessageEvent<ArrayBuffer>) => sendAudio(session, event.data);
      socket.onopen = () => {
        const current = toolRef.current;
        const initialState = readToolState(current.root.current, current.id, current.label);
        socket?.send(JSON.stringify({
          setup: {
            model: `models/${credentials.model}`,
            generationConfig: { responseModalities: ["AUDIO"] },
            inputAudioTranscription: { languageCodes: ["id-ID", "en-US"] },
            outputAudioTranscription: { languageCodes: ["id-ID", "en-US"] },
            systemInstruction: {
              parts: [{ text: `Kamu adalah asisten suara untuk demo alat Labai. Jawab singkat, santai, dan gunakan bahasa pengguna; utamakan Bahasa Indonesia. Kamu memahami satu alat aktif berikut beserta kondisinya. Jika pertanyaan merujuk pada isi alat yang berubah, pilihan aktif, atau angka saat ini, panggil inspect_tool_state sebelum menjawab. Aksi kontrol hanya dilakukan jika pengguna memintanya dengan jelas. Gunakan label tombol, slider, dan sakelar persis seperti yang tersedia. Jangan mengaku mengubah sesuatu jika aksi gagal. Jelaskan alat dengan bahasa mudah, bukan jargon teknis kecuali pengguna memintanya.\n\nALAT DAN KONDISI AWAL:\n${JSON.stringify({ tool: { id: current.id, name: current.label, description: toolDescriptions[current.id] }, state: initialState })}` }],
            },
            tools: [{ functionDeclarations: toolFunctions }],
          },
        }));
      };

      socket.onmessage = (event) => {
        let message: LiveMessage;
        try {
          message = JSON.parse(event.data) as LiveMessage;
        } catch {
          return;
        }

        if (message.setupComplete) {
          if (session.setupTimer) clearTimeout(session.setupTimer);
          session.ready = true;
          session.source.connect(session.processor);
          session.processor.connect(audio!.destination);
          sendState(session);
          setStatus("listening");
        }

        const content = message.serverContent;
        const interimText = content?.interimInputTranscription?.text;
        const inputText = content?.inputTranscription?.text;
        const outputText = content?.outputTranscription?.text;
        if (interimText || inputText) {
          if (!session.userTurnStarted) {
            session.userTurnStarted = true;
            session.turnFinished = false;
            setAssistantText("");
            setUserText("");
          }
        }
        if (interimText) setUserText((previous) => appendTranscript(previous, interimText));
        if (inputText) {
          setUserText((previous) => appendTranscript(previous, inputText));
          setStatus("thinking");
        }
        if (outputText) {
          setAssistantText((previous) => appendTranscript(previous, outputText));
          setStatus("speaking");
        }
        if (content?.modelTurn?.parts) {
          for (const part of content.modelTurn.parts) {
            if (part.inlineData?.data) playAudio(session, part.inlineData.data, part.inlineData.mimeType ?? "audio/pcm;rate=24000");
          }
        }
        if (content?.interrupted) {
          stopPlayback(session);
          session.turnFinished = false;
          setStatus("listening");
        }
        if (content?.turnComplete) {
          session.turnFinished = true;
          session.userTurnStarted = false;
          if (session.sources.size === 0) setStatus("listening");
        }
        if (message.toolCall?.functionCalls) {
          void handleToolCalls(message.toolCall.functionCalls);
        }
        if (message.goAway && sessionRef.current === session) {
          setError("Sesi suara akan berakhir. Mulai lagi untuk melanjutkan.");
        }
      };

      socket.onerror = () => {
        if (sessionRef.current !== session) return;
        setError("Sambungan suara terputus. Coba lagi.");
        closeSession("error");
      };
      socket.onclose = () => {
        if (sessionRef.current !== session || session.intentionalClose) return;
        cleanup(session);
        sessionRef.current = null;
        setError("Sambungan suara berakhir. Mulai lagi untuk melanjutkan.");
        setStatus("error");
      };
    } catch (reason) {
      stream?.getTracks().forEach((track) => track.stop());
      if (audio && audio.state !== "closed") void audio.close();
      if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
      if (cancelConnectRef.current) return;
      const errorName = reason instanceof DOMException ? reason.name : "";
      const message = errorName === "NotAllowedError"
        ? "Izinkan akses mikrofon untuk mulai berbicara."
        : errorName === "NotFoundError"
          ? "Mikrofon tidak ditemukan."
          : reason instanceof Error
            ? reason.message
            : "Asisten suara sedang tidak tersedia. Coba lagi nanti.";
      setError(message);
      setStatus("error");
    } finally {
      connectRef.current = false;
      if (connectAbortRef.current === controller) connectAbortRef.current = null;
    }
  }, [closeSession, handleToolCalls, playAudio, sendAudio, sendState]);

  const toggleSession = useCallback(() => {
    if (sessionRef.current) {
      closeSession("idle");
      setAssistantText("");
      setUserText("");
      setError("");
    } else if (connectRef.current) {
      cancelConnectRef.current = true;
      connectAbortRef.current?.abort();
      setStatus("idle");
      setError("");
    } else {
      void startSession();
    }
  }, [closeSession, startSession]);

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

  const active = status !== "idle" && status !== "error";
  const statusLabel = status === "connecting" ? "Menghubungkan" : status === "listening" ? "Mendengarkan" : status === "thinking" ? "Sebentar ya" : status === "speaking" ? "Labai sedang bicara" : "Asisten suara";
  const speech = error || assistantText || (status === "connecting" ? "Menyiapkan suara…" : status === "error" ? "Asisten suara belum tersedia." : "Silakan bicara. Aku mengikuti alat yang sedang terbuka.");

  return (
    <div className="svg-assistant" data-active={active} data-speaking={status === "speaking"} data-error={status === "error"}>
      {(active || error) && (
        <section className="svg-assistant-bubble" aria-live="polite" aria-label="Percakapan dengan asisten suara">
          <div className="svg-assistant-bubble-top">
            <span className="svg-assistant-orb" aria-hidden="true"><i /><i /><i /></span>
            <span>{status === "error" ? "Ada kendala" : statusLabel}</span>
            <span className="svg-assistant-tool">{toolLabel}</span>
          </div>
          <p>{speech}</p>
          {userText && status !== "speaking" && <span className="svg-assistant-user-text">Kamu: {userText}</span>}
        </section>
      )}
      <button
        className="svg-assistant-trigger"
        type="button"
        onClick={toggleSession}
        aria-label={active ? "Akhiri percakapan suara" : "Tanya alat ini dengan suara"}
        aria-pressed={active}
        title={active ? "Akhiri percakapan" : "Tanya alat ini"}
      >
        {active ? <X size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
        <span>{active ? "Selesai" : "Tanya AI"}</span>
      </button>
      <span className="svg-assistant-sr" role="status">{error}</span>
    </div>
  );
}
