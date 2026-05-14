import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Calendar, Plus, Trash2, CheckCircle2, Circle, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClayButton } from "@/components/ClayButton";
import { format, isPast, parseISO, startOfWeek, addDays } from "date-fns";

export const Route = createFileRoute("/app/planner")({
  head: () => ({ meta: [{ title: "Planner — Nova Learn" }] }),
  component: PlannerPage,
});

type Task = {
  id: string;
  text: string;
  date: string;
  done: boolean;
};

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem("planner-tasks");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function PlannerPage() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [newText, setNewText] = useState("");
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    localStorage.setItem("planner-tasks", JSON.stringify(tasks));
  }, [tasks]);

  const addTask = () => {
    const text = newText.trim();
    if (!text) return;
    setTasks((prev) => [...prev, { id: crypto.randomUUID(), text, date: newDate, done: false }]);
    setNewText("");
  };

  const toggleTask = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return { label: format(d, "EEE"), date: format(d, "yyyy-MM-dd"), isToday: format(d, "yyyy-MM-dd") === format(today, "yyyy-MM-dd") };
  });

  const tasksByDate = Object.fromEntries(
    [...new Set(tasks.map((t) => t.date))].sort().map((d) => [d, tasks.filter((t) => t.date === d)])
  );

  const allDates = [...new Set([...weekDays.map((d) => d.date), ...Object.keys(tasksByDate)])].sort();

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-black flex items-center gap-3">
          <Calendar className="w-9 h-9 text-primary" /> Planner
        </h1>
        <p className="text-muted-foreground mt-1">Plan your study tasks by date — saved in your browser.</p>
      </header>

      <div className="clay-lg bg-card p-5 space-y-3">
        <div className="flex gap-2">
          <div className="clay-pressed bg-card rounded-2xl px-3 h-11 flex items-center gap-2 shrink-0">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="bg-transparent outline-none font-bold text-sm [color-scheme:dark] dark:[color-scheme:dark]"
            />
          </div>
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
            placeholder="Add a task…"
            className="flex-1 h-11 rounded-2xl border-2 border-muted bg-background px-4 text-sm font-bold"
          />
          <ClayButton size="icon" onClick={addTask} disabled={!newText.trim()}>
            <Plus className="w-4 h-4" />
          </ClayButton>
        </div>
      </div>

      <div className="space-y-4">
        {allDates.map((dateStr) => {
          const dayTasks = tasksByDate[dateStr] || [];
          const dt = parseISO(dateStr);
          const overdue = isPast(dt) && !dayTasks.every((t) => t.done);
          const dayLabel = weekDays.find((w) => w.date === dateStr);
          return (
            <div key={dateStr} className={cn("clay-lg bg-card p-4 space-y-2", overdue && "ring-2 ring-destructive/20")}>
              <div className="flex items-center gap-3 mb-2">
                <div className={cn(
                  "h-10 w-10 rounded-xl font-black flex items-center justify-center shrink-0 text-sm clay-sm",
                  dayLabel?.isToday ? "gradient-primary text-white" : "bg-muted text-foreground",
                )}>
                  {format(dt, "d")}
                </div>
                <div>
                  <span className="font-extrabold">{format(dt, "MMM d")}</span>
                  {dayLabel && <span className="text-muted-foreground font-bold ml-2">{dayLabel.label}</span>}
                  {dayLabel?.isToday && <span className="text-primary font-bold ml-2 text-xs">Today</span>}
                  {overdue && <span className="text-destructive font-bold ml-2 text-xs">Overdue</span>}
                </div>
                <span className="text-xs text-muted-foreground font-bold ml-auto">
                  {dayTasks.filter((t) => t.done).length}/{dayTasks.length}
                </span>
              </div>
              {dayTasks.length === 0 && (
                <p className="text-sm text-muted-foreground/60 font-medium px-1">No tasks</p>
              )}
              {dayTasks.map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center gap-3 clay-sm p-3 rounded-2xl transition-all group",
                    task.done && "opacity-50",
                  )}
                >
                  <button onClick={() => toggleTask(task.id)} className="shrink-0 text-primary">
                    {task.done ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                  </button>
                  <span className={cn("flex-1 font-bold text-sm", task.done && "line-through text-muted-foreground")}>
                    {task.text}
                  </span>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="shrink-0 p-1 rounded-lg text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
        {allDates.length === 0 && (
          <p className="clay-lg bg-card p-8 text-center font-bold text-muted-foreground">No tasks yet. Add one above!</p>
        )}
      </div>
    </div>
  );
}
