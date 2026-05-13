import { useState } from "react";
import { Bot, Send, Mic, Image as ImageIcon, Sparkles, X, ChevronRight, ZoomIn, ZoomOut, Brain, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClayButton } from "./ClayButton";
import mascotImg from "@/assets/mascot.png";

type Message = {
  id: string;
  role: "user" | "ai";
  text: string;
  image?: string;
  confidence?: number;
  sources?: string[];
  followups?: string[];
};

const seed: Message[] = [
  {
    id: "1",
    role: "ai",
    text: "Hi! I'm **Nova** ✨ — your AI study buddy. Ask me anything across your subjects. Try `/thinking` for deep reasoning or `/study` for guided learning.",
    confidence: 98,
    followups: ["Explain Pythagoras theorem", "Quiz me on Photosynthesis", "Summarize Chapter 3"],
  },
  {
    id: "2",
    role: "user",
    text: "Show me how a triangle's angles add up to 180°",
  },
  {
    id: "3",
    role: "ai",
    text: "Great question! The sum of interior angles of any triangle equals **180°**. Here's a visual proof:",
    image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800",
    confidence: 96,
    sources: ["NCERT Class 9 — Geometry", "Khan Academy"],
    followups: ["Prove it with parallel lines", "Try a practice problem", "Show exterior angles"],
  },
];

export function ChatbotPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(seed);
  const [input, setInput] = useState("");
  const [zoomed, setZoomed] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const send = () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: String(Date.now()), role: "user", text: input };
    const aiMsg: Message = {
      id: String(Date.now() + 1),
      role: "ai",
      text: "Let me think on that... here's a concise explanation tailored to your level.",
      confidence: 92,
      sources: ["NCERT", "Shaalaa.com"],
      followups: ["Go deeper", "Give me an example", "Quiz me"],
    };
    setMessages((m) => [...m, userMsg, aiMsg]);
    setInput("");
  };

  return (
    <>
      {/* Toggle FAB (mobile + collapsed) */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed bottom-6 right-6 z-40 h-16 w-16 rounded-full clay-lg gradient-primary text-white",
          "flex items-center justify-center hover:-translate-y-1 transition-all glow-purple",
          open && "lg:hidden"
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
          "lg:relative lg:translate-x-0 lg:w-[400px] lg:shrink-0"
        )}
      >
        <div className="h-full flex flex-col clay-lg overflow-hidden">
          {/* Header */}
          <header className="p-4 flex items-center gap-3 border-b border-border/50">
            <div className="relative">
              <div className="h-12 w-12 rounded-2xl gradient-primary flex items-center justify-center clay-sm">
                <img src={mascotImg} alt="" width={40} height={40} className="w-10 h-10 object-contain" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-card" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-extrabold text-base">Nova</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-clay-yellow" /> AI Tutor • All subjects
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="lg:hidden h-9 w-9 rounded-xl clay-sm flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </header>

          {/* Mode chips */}
          <div className="px-4 py-2 flex gap-2 overflow-x-auto">
            {[
              { icon: Brain, label: "/thinking", color: "gradient-primary text-white" },
              { icon: BookOpen, label: "/study", color: "gradient-cyan text-white" },
              { icon: Sparkles, label: "/quiz", color: "gradient-yellow text-amber-900" },
            ].map((m) => (
              <button
                key={m.label}
                onClick={() => setInput((i) => `${m.label} ${i}`.trim())}
                className={cn("px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 clay-sm shrink-0", m.color)}
              >
                <m.icon className="w-3 h-3" /> {m.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} m={m} onImage={(src) => { setZoomed(src); setZoom(1); }} />
            ))}
          </div>

          {/* Composer */}
          <div className="p-3 border-t border-border/50">
            <div className="clay-pressed rounded-2xl p-2 flex items-center gap-1">
              <button className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-muted">
                <ImageIcon className="w-4 h-4" />
              </button>
              <button className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-muted">
                <Mic className="w-4 h-4" />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask Nova anything..."
                className="flex-1 bg-transparent outline-none text-sm font-medium px-2"
              />
              <ClayButton size="icon" onClick={send} aria-label="Send">
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
          <div className="relative max-w-4xl max-h-[90vh] clay-lg p-3 bg-card" onClick={(e) => e.stopPropagation()}>
            <div className="absolute -top-3 -right-3 flex gap-2 z-10">
              <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="h-10 w-10 rounded-full clay bg-card flex items-center justify-center"><ZoomOut className="w-4 h-4"/></button>
              <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="h-10 w-10 rounded-full clay bg-card flex items-center justify-center"><ZoomIn className="w-4 h-4"/></button>
              <button onClick={() => setZoomed(null)} className="h-10 w-10 rounded-full clay gradient-primary text-white flex items-center justify-center"><X className="w-4 h-4"/></button>
            </div>
            <div className="overflow-auto max-h-[80vh] rounded-2xl">
              <img src={zoomed} alt="Expanded" style={{ transform: `scale(${zoom})`, transformOrigin: "center" }} className="transition-transform duration-200 max-w-full" />
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
        <div className="max-w-[85%] gradient-primary text-white rounded-2xl rounded-tr-sm px-4 py-3 clay-sm text-sm font-medium">
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
        <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed">
          <span dangerouslySetInnerHTML={{ __html: m.text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-card text-primary text-xs font-mono">$1</code>') }} />
        </div>
        {m.image && (
          <button onClick={() => onImage(m.image!)} className="block w-full clay-sm rounded-2xl overflow-hidden hover:-translate-y-0.5 transition-transform">
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
              <button key={f} className="text-xs px-2.5 py-1.5 rounded-xl clay-sm bg-card hover:-translate-y-0.5 transition-transform flex items-center gap-1">
                {f} <ChevronRight className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
