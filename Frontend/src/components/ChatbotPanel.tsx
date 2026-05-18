import { useCallback, useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  Bot,
  Send,
  Image as ImageIcon,
  Sparkles,
  X,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Brain,
  Square,
  Plus,
  History,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ClayButton } from "./ClayButton";
import mascotImg from "@/assets/mascot.png";
import { apiPath, tutorPath } from "@/lib/api";

function genId(): string {
  return "chat_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const NOTEBOOK_KEY = "notebook-notes";

/** Reads the current URL to extract subject + chapter context for the model. */
function useSubjectContext(): { subject: string | null; chapter: string | null } {
  const path = useRouterState({ select: (s) => s.location.pathname });
  // /app/chapter/<chapterId>?subjectName=...
  const chapterMatch = path.match(/\/app\/chapter\/(.+)/);
  if (chapterMatch) {
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    return {
      subject: params.get("subjectName"),
      chapter: decodeURIComponent(chapterMatch[1]),
    };
  }
  // /app/subject/<subjectId>
  const subjectMatch = path.match(/\/app\/subject\/(.+)/);
  if (subjectMatch) {
    const slug = subjectMatch[1];
    const subject = decodeURIComponent(slug)
      .split("-")
      .map((w, i) => {
        const capped = w.charAt(0).toUpperCase() + w.slice(1);
        if (i === 0) return capped;
        return capped.replace(/\b(And|Of|The|In|To|A|An|For|Or|At|By|With|Its)\b/g, (m) => m.toLowerCase());
      })
      .join(" ");
    return { subject, chapter: null };
  }
  return { subject: null, chapter: null };
}


type Message = {
  id: string;
  role: "user" | "ai";
  text: string;
  /** Model reasoning trace (e.g. DeepSeek `/thinking`); shown separately from the answer. */
  thinking?: string;
  images?: string[];
  confidence?: number;
  sources?: string[];
  citationMap?: Record<string, { source: string; textbook?: string; chapter?: string }>;
  followups?: string[];
  isError?: boolean;
};

function renderTutorMarkdown(text: string, citationMap?: Record<string, { source: string; textbook?: string; chapter?: string }>) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\d+\])/g);
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
    const cite = p.match(/^\[(\d+)\]$/);
    if (cite && citationMap?.[cite[1]]) {
      const src = citationMap[cite[1]];
      return (
        <sup key={i} className="relative group">
          <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-[3px] rounded-sm bg-primary/15 text-primary text-[10px] font-bold cursor-help hover:bg-primary/25 transition-colors">
            {cite[1]}
          </span>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-lg bg-popover text-popover-foreground text-[10px] font-medium shadow-lg border border-border whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            {src.source}
          </span>
        </sup>
      );
    }
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
        <span className="font-semibold text-foreground">/diagrams</span> (visual diagrams), or{" "}
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
  const [sessionId, setSessionId] = useState(genId);
  const [pastSessions, setPastSessions] = useState<{ sessionId: string; title: string; updatedAt: string }[]>([]);
  const [showPast, setShowPast] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { subject, chapter } = useSubjectContext();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetch(apiPath("/api/chat/sessions"), {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.sessions) setPastSessions(d.sessions);
        })
        .catch(() => {});
    }
  }, []);

  const send = useCallback(async () => {
    const raw = input.trim();
    if (!raw || isSending) return;

    const deep = /^\/thinking(\s|$)/i.test(raw);
    const diagrams = /^\/diagrams(\s|$)/i.test(raw);
    const quiz = /^\/quiz(\s|$)/i.test(raw);
    const stripped = raw.replace(/^\/thinking\s*/i, "").replace(/^\/diagrams\s*/i, "").replace(/^\/quiz\s*/i, "").trim();
    let queryForApi = stripped || raw;

    if (quiz) {
      queryForApi =
        `You are a quiz generator. Create exactly 5 multiple-choice questions about "${queryForApi}".\n\n` +
        `Format each question like this (no extra text before/after):\n` +
        `1. Question text\n` +
        `A) Option 1\nB) Option 2\nC) Option 3\nD) Option 4\n\n` +
        `After all 5 questions, wait for my answers. I will reply with all answers at once like "1A 2B 3C 4D 5A".\n` +
        `Then tell me which were correct/wrong with brief explanations.`;
    }

    // Prepend subject/chapter context so Ollama knows the current lesson
    if (subject) {
      const prefix = chapter
        ? `/subject:${subject} /chapter:${chapter} `
        : `/subject:${subject} `;
      queryForApi = prefix + queryForApi;
    }

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text: raw };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setIsSending(true);

    // Placeholder AI message that we update token-by-token
    const aiId = `a-${Date.now()}`;
    setMessages((m) => [...m, { id: aiId, role: "ai", text: "" }]);

    // Fire image fetch immediately in parallel for /diagrams
    if (diagrams) {
      const imgQuery = [stripped || raw, chapter, subject].filter(Boolean).join(" ") + " diagram illustration";
      (async () => {
        try {
          const res = await fetch(`/imglinks?query=${encodeURIComponent(imgQuery)}`);
          const data = await res.json();
          const imgs = data?.images;
          if (imgs && imgs.length > 0) {
            setMessages((m) =>
              m.map((msg) =>
                msg.id === aiId ? { ...msg, images: imgs } : msg
              )
            );
          }
        } catch (e) {
          console.error("imglinks fetch failed:", e);
        }
      })();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    let thinkingAcc = "";
    let replyAcc = "";
    let citationMap: Record<string, { source: string; textbook?: string; chapter?: string }> | null = null;

    try {
      const useRag = Boolean(subject);
      const url =
        `${tutorPath("/chat")}` +
        `?query=${encodeURIComponent(queryForApi)}` +
        `&session_id=${encodeURIComponent(sessionId)}` +
        `&deep_research=${deep}` +
        `&use_rag=${useRag}`;

      const res = await fetch(url, { method: "POST", signal: controller.signal });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({})) as { detail?: string; error?: string };
        const errText =
          errData.error ?? errData.detail ??
          (res.status === 400
            ? "That message could not be sent. Check length or try a clearer question."
            : "Nova could not answer right now. Ensure Ollama is running and try again.");
        setMessages((m) =>
          m.map((msg) =>
            msg.id === aiId ? { ...msg, text: errText, isError: true } : msg
          )
        );
        return;
      }

      // Stream NDJSON lines
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Throttle live UI updates to every ~50ms for smoothness
      let rafId: number | undefined;
      const flush = () => {
        rafId = undefined;
        setMessages((m) =>
          m.map((msg) =>
            msg.id === aiId
              ? { ...msg, text: replyAcc || "…", thinking: thinkingAcc || undefined }
              : msg
          )
        );
      };
      const scheduleFlush = () => {
        if (rafId === undefined) rafId = window.setTimeout(flush, 300);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process every complete line
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep incomplete tail

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const chunk = JSON.parse(trimmed) as {
              response?: string;
              thinking?: boolean;
              error?: string;
              notice?: string;
              type?: string;
              citations?: Record<string, { source: string; textbook?: string; chapter?: string }>;
            };

            if (chunk.error) {
              setMessages((m) =>
                m.map((msg) =>
                  msg.id === aiId ? { ...msg, text: chunk.error!, isError: true } : msg
                )
              );
              break;
            }

            if (chunk.type === "citations" && chunk.citations) {
              citationMap = chunk.citations;
              continue;
            }

            if (chunk.notice && !replyAcc && !thinkingAcc && !quiz) {
              replyAcc = "📝 " + chunk.notice + "\n\n";
              flush();
            }

            if (chunk.response) {
              if (chunk.thinking) {
                thinkingAcc += chunk.response;
              } else {
                replyAcc += chunk.response;
              }
              scheduleFlush();
            }
          } catch {
            // Malformed JSON chunk — skip
          }
        }
      }
      // Final flush after stream ends — attach citations if present
      if (rafId !== undefined) clearTimeout(rafId);
      if (citationMap) {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === aiId
              ? { ...msg, text: replyAcc || "…", thinking: thinkingAcc || undefined, citationMap }
              : msg
          )
        );
      } else {
        flush();
      }

      // Final clean-up: if nothing came through, show error
      if (!replyAcc.trim()) {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === aiId
              ? { ...msg, text: "Nova returned an empty reply. Is Ollama running?", isError: true }
              : msg
          )
        );
      }

    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === aiId
              ? { ...msg, text: replyAcc || "(interrupted)", thinking: thinkingAcc || undefined }
              : msg
          )
        );
      } else {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === aiId
              ? {
                  ...msg,
                  text: "Could not reach the tutor service. From Backend/Chatbot_LLM run: python main.py",
                  isError: true,
                }
              : msg
          )
        );
      }
    } finally {
      setIsSending(false);
      abortRef.current = null;
    }
  }, [input, isSending, sessionId]);

  const interrupt = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  const saveSession = useCallback(async () => {
    if (messages.length === 0) return;
    const title = messages.find((m) => m.role === "user")?.text.slice(0, 60) || "Chat session";
    const token = localStorage.getItem("token");
    const body = JSON.stringify({
      sessionId,
      title,
      messages: messages.map((m) => ({ role: m.role, text: m.text, images: m.images })),
    });
    if (token) {
      fetch(apiPath("/api/chat/sessions"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body,
      }).catch(() => {});
    }
    // Also save as notebook note (localStorage)
    try {
      const raw = localStorage.getItem(NOTEBOOK_KEY);
      const notes: { id: string; title: string; content: string; createdAt: string; updatedAt: string }[] = raw ? JSON.parse(raw) : [];
      const chatText = messages.map((m) => {
        const prefix = m.role === "user" ? "You" : "Nova";
        const imgs = m.images?.length ? m.images.join("\n") + "\n" : "";
        return `${prefix}: ${imgs}${m.text}`;
      }).join("\n\n");
      notes.unshift({
        id: sessionId,
        title: "💬 " + title,
        content: chatText,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(notes));
    } catch {}
  }, [messages, sessionId]);

  const newChat = useCallback(() => {
    saveSession();
    setMessages([]);
    const newId = genId();
    setSessionId(newId);
    setShowPast(false);
    // Clear backend session history so old context isn't used
    fetch(tutorPath("/chat/history/clear"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: newId }),
    }).catch(() => {});
    // Refresh past sessions list
    const token = localStorage.getItem("token");
    if (token) {
      fetch(apiPath("/api/chat/sessions"), {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.sessions) setPastSessions(d.sessions);
        })
        .catch(() => {});
    }
  }, [saveSession]);

  return (
    <>
      {/* Toggle FAB (mobile + collapsed) */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed bottom-6 right-6 z-40 h-16 w-16 rounded-full clay-lg gradient-primary text-white",
          "flex items-center justify-center transition-all duration-300 glow-purple hover:scale-110 active:scale-95 shadow-lg",
          open ? "scale-0 opacity-0 pointer-events-none" : "scale-100 opacity-100 hover:shadow-[0_0_20px_rgba(168,85,247,0.6)]",
        )}
        aria-label="Toggle Nova chat"
      >
        <img src={mascotImg} alt="" width={48} height={48} className="w-12 h-12 object-contain drop-shadow-md" />
      </button>

      {/* Panel */}
      <aside
        className={cn(
          "fixed top-0 right-0 z-50 h-screen w-full sm:w-[420px] p-3 sm:p-4 transition-all duration-500 ease-in-out",
          open ? "translate-x-0 opacity-100 shadow-[-10px_0_30px_rgba(0,0,0,0.1)]" : "translate-x-full opacity-0 pointer-events-none",
        )}
      >
        <div className="h-full flex flex-col clay-lg overflow-hidden border border-border/40 shadow-xl bg-background/95 backdrop-blur-xl">
          {/* Header */}
          <header className="p-4 flex items-center gap-2 border-b border-border/50 shrink-0">
            <div className="relative">
              <div className="h-10 w-10 rounded-2xl gradient-primary flex items-center justify-center clay-sm shadow-md">
                <img
                  src={mascotImg}
                  alt=""
                  width={36}
                  height={36}
                  className="w-9 h-9 object-contain drop-shadow-sm"
                />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-card shadow-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-extrabold text-sm">Nova</h3>
            </div>
            {pastSessions.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowPast(!showPast);
                  if (!showPast) {
                    const token = localStorage.getItem("token");
                    if (token) {
                      fetch(apiPath("/api/chat/sessions"), {
                        headers: { Authorization: `Bearer ${token}` },
                      })
                        .then((r) => r.json())
                        .then((d) => {
                          if (d.sessions) setPastSessions(d.sessions);
                        })
                        .catch(() => {});
                    }
                  }
                }}
                className="h-8 w-8 rounded-xl clay-sm flex items-center justify-center hover:bg-muted transition-colors"
                title="Past chats"
              >
                <History className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={newChat}
              className="h-8 w-8 rounded-xl clay-sm flex items-center justify-center hover:bg-muted transition-colors"
              title="New chat"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="h-8 w-8 rounded-xl clay-sm flex items-center justify-center hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          {/* Mode shortcuts directly above the chat transcript */}
          <div className="px-4 py-2.5 flex gap-2 overflow-x-auto border-b border-border/40 shrink-0 bg-card/30">
            {[
              { icon: Brain, label: "/thinking", color: "gradient-primary text-white" },
              { icon: ImageIcon, label: "/diagrams", color: "gradient-cyan text-white" },
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

          {/* Messages / Past chats */}
          <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
            {showPast ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground px-1 pb-1">Past chats</p>
                {pastSessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1">No past chats yet.</p>
                ) : (
                  pastSessions.map((s) => (
                    <button
                      key={s.sessionId}
                      type="button"
                      onClick={() => {
                        const token = localStorage.getItem("token");
                        if (token) {
                          fetch(apiPath(`/api/chat/sessions/${s.sessionId}`), {
                            headers: { Authorization: `Bearer ${token}` },
                          })
                            .then((r) => r.json())
                            .then((d) => {
                              if (d.messages) {
                                setMessages(
                                  d.messages.map((m: { role: string; text: string; images?: string[] }, i: number) => ({
                                    id: `${s.sessionId}-${i}`,
                                    role: m.role as "user" | "ai",
                                    text: m.text,
                                    images: m.images,
                                  })),
                                );
                                setSessionId(s.sessionId);
                                setShowPast(false);
                              }
                            })
                            .catch(() => {});
                        }
                      }}
                      className="w-full text-left clay-sm bg-card p-3 rounded-xl hover:-translate-y-0.5 transition-all group"
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-3 h-3 shrink-0 text-muted-foreground" />
                        <span className="text-xs font-bold truncate flex-1">{s.title}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const token = localStorage.getItem("token");
                            if (token) {
                              fetch(apiPath(`/api/chat/sessions/${s.sessionId}`), {
                                method: "DELETE",
                                headers: { Authorization: `Bearer ${token}` },
                              })
                                .then(() => {
                                  setPastSessions((prev) => prev.filter((p) => p.sessionId !== s.sessionId));
                                })
                                .catch(() => {});
                            }
                          }}
                          className="h-6 w-6 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(s.updatedAt).toLocaleDateString()}
                      </p>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <EmptyIntro />
                ) : (
                  messages.map((m, idx) => (
                    <MessageBubble
                      key={m.id}
                      m={m}
                      streaming={isSending && idx === messages.length - 1}
                      onImage={(src) => {
                        setZoomed(src);
                        setZoom(1);
                      }}
                    />
                  ))
                )}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="p-3 border-t border-border/50 shrink-0">
            <div className="clay-pressed rounded-2xl p-1 flex items-center gap-1">
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
                rows={1}
                className="flex-1 max-h-32 bg-transparent outline-none resize-none text-sm font-medium px-3 py-2 leading-normal"
                disabled={isSending}
                aria-label="Message to Nova"
              />
              {isSending ? (
                <button
                  type="button"
                  onClick={interrupt}
                  className="shrink-0 self-end mb-0.5 h-10 w-10 rounded-xl bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors"
                  aria-label="Stop generating"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <ClayButton
                  size="icon"
                  className="shrink-0 self-end mb-0.5"
                  onClick={() => void send()}
                  aria-label="Send"
                >
                  <Send className="w-4 h-4" />
                </ClayButton>
              )}
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

function ThinkingBlock({ thinking, defaultOpen }: { thinking: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  if (!thinking.trim()) return null;

  return (
    <div className="rounded-2xl rounded-tl-sm border border-violet-200 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-950/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full text-left not-italic font-bold text-[10px] uppercase tracking-wide text-violet-600 dark:text-violet-400 mb-1"
      >
        <ChevronRight
          className={cn(
            "w-3 h-3 transition-transform duration-200",
            open && "rotate-90",
          )}
        />
        Reasoning
      </button>
      {open && (
        <div className="break-words whitespace-pre-wrap border-t border-violet-200/50 dark:border-violet-800/50 pt-1.5 mt-1">
          {renderTutorMarkdown(thinking)}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ m, onImage, streaming }: { m: Message; onImage: (src: string) => void; streaming?: boolean }) {
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
          <ThinkingBlock thinking={m.thinking} defaultOpen={streaming} />
        )}
        {m.images && m.images.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {m.images.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onImage(src)}
                className="block clay-sm rounded-2xl overflow-hidden hover:-translate-y-0.5 transition-transform"
              >
                <img src={src} alt={`AI illustration ${i + 1}`} className="w-full h-36 object-cover" />
              </button>
            ))}
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
          {renderTutorMarkdown(m.text, m.citationMap)}
        </div>
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
