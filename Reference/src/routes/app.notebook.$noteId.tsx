import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Save, Trash2, Loader2 } from "lucide-react";
import { ClayButton } from "@/components/ClayButton";

export const Route = createFileRoute("/app/notebook/$noteId")({
  head: () => ({ meta: [{ title: "Note — Nova Learn" }] }),
  component: NoteEditorPage,
});

type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "notebook-notes";

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotes(notes: Note[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function NoteEditorPage() {
  const { noteId } = Route.useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialisedRef = useRef(false);

  useEffect(() => {
    const notes = loadNotes();
    const found = notes.find((n) => n.id === noteId);
    if (found) {
      setNote(found);
      setTitle(found.title);
      setContent(found.content);
    }
    initialisedRef.current = true;
  }, [noteId]);

  useEffect(() => {
    if (!initialisedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaved(false);
    timerRef.current = setTimeout(() => {
      const notes = loadNotes();
      const updated = notes.map((n) =>
        n.id === noteId ? { ...n, title, content, updatedAt: new Date().toISOString() } : n,
      );
      saveNotes(updated);
      setNote((prev) =>
        prev ? { ...prev, title, content, updatedAt: new Date().toISOString() } : prev,
      );
      setSaved(true);
    }, 600);
  }, [title, content, noteId]);

  const deleteNote = () => {
    const notes = loadNotes().filter((n) => n.id !== noteId);
    saveNotes(notes);
    navigate({ to: "/app/notebook" });
  };

  if (!note && initialisedRef.current) {
    return (
      <div className="p-10 max-w-md mx-auto text-center space-y-4">
        <p className="font-bold text-destructive">Note not found.</p>
        <Link to="/app/notebook">
          <ClayButton variant="white">Back to notebook</ClayButton>
        </Link>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Link
          to="/app/notebook"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> All notes
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
            <Save className="w-3 h-3" />
            {saved ? "Saved" : "Saving..."}
          </span>
          <button
            onClick={deleteNote}
            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title"
        className="w-full text-3xl font-black bg-transparent outline-none placeholder:text-muted-foreground/40"
      />

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Start writing..."
        className="w-full min-h-[60vh] bg-card clay-lg p-6 rounded-2xl text-sm font-medium leading-relaxed outline-none resize-y placeholder:text-muted-foreground/40"
      />
    </div>
  );
}
