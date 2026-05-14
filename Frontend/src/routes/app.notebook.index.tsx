import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, NotebookPen, Search, Trash2, Clock, FileText } from "lucide-react";
import { ClayButton } from "@/components/ClayButton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export const Route = createFileRoute("/app/notebook/")({
  head: () => ({ meta: [{ title: "Notebook — Nova Learn" }] }),
  component: NotebookPage,
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

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function NotebookPage() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setNotes(loadNotes());
  }, []);

  const createNote = () => {
    const now = new Date().toISOString();
    const note: Note = {
      id: generateId(),
      title: "Untitled",
      content: "",
      createdAt: now,
      updatedAt: now,
    };
    const updated = [note, ...notes];
    setNotes(updated);
    saveNotes(updated);
    navigate({ to: "/app/notebook/$noteId", params: { noteId: note.id } });
  };

  const deleteNote = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    saveNotes(updated);
  };

  const filtered = search.trim()
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.content.toLowerCase().includes(search.toLowerCase()),
      )
    : notes;

  const preview = (content: string) =>
    content.replace(/<[^>]*>/g, "").slice(0, 120) || "No content";

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3">
            <NotebookPen className="w-8 h-8 text-primary" /> Notebook
          </h1>
          <p className="text-muted-foreground mt-1">
            Write notes, ideas, and summaries — saved in your browser.
          </p>
        </div>
        <ClayButton size="lg" onClick={createNote} className="shrink-0">
          <Plus className="w-4 h-4" /> New note
        </ClayButton>
      </div>

      <div className="clay-pressed bg-card rounded-2xl px-4 h-12 flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes…"
          className="bg-transparent outline-none flex-1 font-bold text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="clay-lg bg-card p-12 text-center space-y-3">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground" />
          <p className="font-bold text-muted-foreground">
            {search ? "No notes match your search." : "No notes yet. Create your first one!"}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((note) => (
            <button
              key={note.id}
              onClick={() => navigate({ to: "/app/notebook/$noteId", params: { noteId: note.id } })}
              className="clay-lg bg-card p-5 text-left hover:-translate-y-0.5 transition-all group"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-extrabold truncate flex-1">{note.title || "Untitled"}</h3>
                <button
                  onClick={(e) => deleteNote(e, note.id)}
                  className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground font-medium leading-relaxed line-clamp-3">
                {preview(note.content)}
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                <Clock className="w-3 h-3" />
                {format(new Date(note.updatedAt), "MMM d, h:mm a")}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
