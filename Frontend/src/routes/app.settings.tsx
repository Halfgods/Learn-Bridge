import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useMe } from "@/hooks/useMe";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Settings — Nova Learn" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: user } = useMe();
  return (
    <div className="p-6 lg:p-10 max-w-xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-black flex items-center gap-3">
          <Settings className="w-9 h-9 text-primary" /> Settings
        </h1>
      </header>
      <div className="clay-lg bg-card p-6 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground font-bold">Name</span>
          <span className="font-extrabold text-right">{user?.name || "—"}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground font-bold">Email</span>
          <span className="font-extrabold text-right break-all">{user?.email || "—"}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground font-bold">Account</span>
          <span className="font-extrabold capitalize">{user?.role === "teacher" ? "Teacher" : "Student"}</span>
        </div>
        {user?.grade != null && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground font-bold">Class</span>
            <span className="font-extrabold">{user.grade}</span>
          </div>
        )}
        {user?.board && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground font-bold">Board</span>
            <span className="font-extrabold">{user.board}</span>
          </div>
        )}
      </div>
    </div>
  );
}
