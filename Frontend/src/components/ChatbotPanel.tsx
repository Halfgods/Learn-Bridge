import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  Send,
  Mic,
  Image as ImageIcon,
  Sparkles,
  X,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Brain,
  BookOpen,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ClayButton } from "./ClayButton";
import mascotImg from "@/assets/mascot.png";
import { tutorPath } from "@/lib/api";

const NOVA_SESSION_ID = "nova-panel";

type Message = {
  id: string;
  role: "user" | "ai";
  text: string;
  /** Model reasoning trace (e.g. DeepSeek `/thinking`); shown separately from the answer. */
  thinking?: string;
  image?: string;
  confidence?: number;
  sources?: string[];
  followups?: string[];
  isError?: boolean;
};

function renderTutorMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    const bold = p.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={i}>{bold[1]}</strong>;
    const code = p.match(/^`([^`]+)`$/);
    if (code)
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-card text-primary text-xs font-mono">
          {code[1]}
        </code>
      );
    return <span key={i}>{p}</span>;
  });
}

function EmptyIntro() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-5 py-10 min-h-[240px]">
      <img
        src={mascotImg}
        alt=""
        width={112}
        height={112}
        className="w-28 h-28 object-contain mb-5 animate-float drop-shadow-[0_18px_28px_rgba(120,80,200,0.3)]"
      />
      <h4 className="font-extrabold text-lg text-foreground mb-2">Hi! I&apos;m Nova</h4>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mb-2">
        Your AI study buddy across all your subjects. Ask anything from your syllabus, get
        step-by-step help, or practice with quick checks.
      </p>
      <p className="text-xs text-muted-foreground/90 leading-relaxed max-w-[280px]">
        Use the shortcuts above the chat for{" "}
        <span className="font-semibold text-foreground">/thinking</span> (deeper reasoning),{" "}
        <span className="font-semibold text-foreground">/study</span> (guided walkthrough), or{" "}
        <span className="font-semibold text-foreground">/quiz</span> when you want to be tested.
      </p>
    </div>
  );
}

export function ChatbotPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [zoomed, setZoomed] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    void fetch(tutorPath("/chat/history/clear"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: NOVA_SESSION_ID }),
    }).catch(() => {});
  }, []);

  const send = useCallback(async () => {
    const raw = input.trim();
    if (!raw || isSending) return;

    const deep = /^\/thinking(\s|$)/i.test(raw);
    const stripped = raw.replace(/^\/thinking\s*/i, "").trim();
    const queryForApi = stripped || raw;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text: raw };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch(tutorPath("/chat/sync"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryForApi,
          session_id: NOVA_SESSION_ID,
          deep_research: deep,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        reply?: string;
        thinking?: string;
      };

      if (!res.ok) {
        const errText =
          typeof data.error === "string"
            ? data.error
            : typeof data.detail === "string"
              ? data.detail
              : res.status === 400
                ? "That message could not be sent. Check length, wording, or try a clearer study question."
                : "Nova could not answer right now. Ensure Ollama is running (or Gemini keys are set) and try again.";
        setMessages((m) => [
          ...m,
          {
            id: `e-${Date.now()}`,
            role: "ai",
            text: errText,
            isError: true,
          },
        ]);
        return;
      }

      const reply = typeof data.reply === "string" ? data.reply : "";
      const thinkingRaw = typeof data.thinking === "string" ? data.thinking.trim() : "";
      const thinking = thinkingRaw.length > 0 ? thinkingRaw : undefined;
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "ai",
          text: reply || "(No text returned)",
          thinking,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: `e-${Date.now()}`,
          role: "ai",
          text: "Could not reach the tutor service. From Backend/Chatbot_LLM run: python main.py (uvicorn on port 8000; Vite proxies /llm here).",
          isError: true,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }, [input, isSending]);

  return (
    <>
      {/* Toggle FAB (mobile + collapsed) */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed bottom-6 right-6 z-40 h-16 w-16 rounded-full clay-lg gradient-primary text-white",
          "flex items-center justify-center hover:-translate-y-1 transition-all glow-purple",
          open && "lg:hidden",
        )}
        aria-label="Toggle Nova chat"
      >
        <img src={mascotImg} alt="" width={48} height={48} className="w-12 h-12 object-contain" />
      </button>

      {/* Panel */}
      <aside
        className={cn(
          "fixed top-0 right-0 z-30 h-screen w-full sm:w-[420px] p-3 sm:p-4 transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0 lg:pointer-events-auto",
          "lg:relative lg:translate-x-0 lg:w-[400px] lg:shrink-0",
        )}
      >
        <div className="h-full flex flex-col clay-lg overflow-hidden">
          {/* Header */}
          <header className="p-4 flex items-center gap-3 border-b border-border/50 shrink-0">
            <div className="relative">
              <div className="h-12 w-12 rounded-2xl gradient-primary flex items-center justify-center clay-sm">
                <img
                  src={mascotImg}
                  alt=""
                  width={40}
                  height={40}
                  className="w-10 h-10 object-contain"
                />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-card" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-extrabold text-base">Nova</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-clay-yellow" /> AI Tutor • All subjects
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="lg:hidden h-9 w-9 rounded-xl clay-sm flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          {/* Mode shortcuts directly above the chat transcript */}
          <div className="px-4 py-2.5 flex gap-2 overflow-x-auto border-b border-border/40 shrink-0 bg-card/30">
            {[
              { icon: Brain, label: "/thinking", color: "gradient-primary text-white" },
              { icon: BookOpen, label: "/study", color: "gradient-cyan text-white" },
              { icon: Sparkles, label: "/quiz", color: "gradient-yellow text-amber-900" },
            ].map((m) => (
              <button
                key={m.label}
                type="button"
                onClick={() => setInput((i) => `${m.label} ${i}`.trim())}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 clay-sm shrink-0",
                  m.color,
                )}
              >
                <m.icon className="w-3 h-3" /> {m.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4 min-h-0">
            {messages.length === 0 ? (
              <EmptyIntro />
            ) : (
              <>
                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    m={m}
                    onImage={(src) => {
                      setZoomed(src);
                      setZoom(1);
                    }}
                  />
                ))}
                {isSending && (
                  <div className="flex gap-2 text-muted-foreground text-sm px-1 pb-2">
                    <Loader2 className="w-4 h-4 shrink-0 animate-spin mt-0.5" aria-hidden />
                    <span>Nova is thinking…</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Composer */}
          <div className="p-3 border-t border-border/50 shrink-0">
            <div className="clay-pressed rounded-2xl p-2 flex items-end gap-1">
              <button
                type="button"
                className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center hover:bg-muted self-end mb-0.5"
                aria-label="Attach image"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center hover:bg-muted self-end mb-0.5"
                aria-label="Voice input"
              >
                <Mic className="w-4 h-4" />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Ask Nova anything…"
                rows={2}
                className="flex-1 min-h-[2.75rem] max-h-[10rem] resize-y bg-transparent outline-none text-sm font-medium px-2 py-2 leading-snug break-words whitespace-pre-wrap"
                disabled={isSending}
                aria-label="Message to Nova"
              />
              <ClayButton
                size="icon"
                className="shrink-0 self-end mb-0.5"
                onClick={() => void send()}
                aria-label="Send"
                disabled={isSending}
              >
                <Send className="w-4 h-4" />
              </ClayButton>
            </div>
          </div>
        </div>
      </aside>

      {/* Image modal */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-[pop_0.25s_ease-out]"
          onClick={() => setZoomed(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] clay-lg p-3 bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute -top-3 -right-3 flex gap-2 z-10">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                className="h-10 w-10 rounded-full clay bg-card flex items-center justify-center"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                className="h-10 w-10 rounded-full clay bg-card flex items-center justify-center"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoomed(null)}
                className="h-10 w-10 rounded-full clay gradient-primary text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-auto max-h-[80vh] rounded-2xl">
              <img
                src={zoomed}
                alt="Expanded"
                style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
                className="transition-transform duration-200 max-w-full"
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground px-2">
              <span>Pinch / use buttons to zoom • Tap outside to close</span>
              <span className="font-bold text-foreground">{Math.round(zoom * 100)}%</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({ m, onImage }: { m: Message; onImage: (src: string) => void }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] gradient-primary text-white rounded-2xl rounded-tr-sm px-4 py-3 clay-sm text-sm font-medium break-words whitespace-pre-wrap">
          {m.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <div className="h-8 w-8 shrink-0 rounded-xl gradient-primary flex items-center justify-center clay-sm">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        {m.thinking && !m.isError && (
          <div
            className="rounded-2xl rounded-tl-sm border border-border/60 bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground italic"
            role="region"
            aria-label="Reasoning"
          >
            <div className="not-italic font-bold text-[10px] uppercase tracking-wide text-muted-foreground/80 mb-1.5">
              Reasoning
            </div>
            <div className="break-words whitespace-pre-wrap">{renderTutorMarkdown(m.thinking)}</div>
          </div>
        )}
        <div
          className={cn(
            "rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed break-words whitespace-pre-wrap",
            m.isError
              ? "bg-destructive/10 text-destructive border border-destructive/25"
              : "bg-muted",
          )}
        >
          {renderTutorMarkdown(m.text)}
        </div>
        {m.image && (
          <button
            type="button"
            onClick={() => onImage(m.image!)}
            className="block w-full clay-sm rounded-2xl overflow-hidden hover:-translate-y-0.5 transition-transform"
          >
            <img src={m.image} alt="AI illustration" className="w-full h-40 object-cover" />
          </button>
        )}
        {(m.confidence || m.sources) && (
          <div className="flex items-center gap-2 px-1 text-xs">
            {m.confidence && (
              <span className="px-2 py-1 rounded-full gradient-mint text-emerald-900 font-bold">
                {m.confidence}% confident
              </span>
            )}
            {m.sources && (
              <span className="text-muted-foreground truncate">
                Sources: {m.sources.join(" • ")}
              </span>
            )}
          </div>
        )}
        {m.followups && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {m.followups.map((f) => (
              <button
                key={f}
                type="button"
                className="text-xs px-2.5 py-1.5 rounded-xl clay-sm bg-card hover:-translate-y-0.5 transition-transform flex items-center gap-1"
              >
                {f} <ChevronRight className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
