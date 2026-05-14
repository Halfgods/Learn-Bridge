import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Blobs } from "@/components/Blobs";
import { AppSidebar } from "@/components/AppSidebar";
import { ChatbotPanel } from "@/components/ChatbotPanel";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="relative min-h-screen flex">
      <Blobs />
      <AppSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden pb-24 lg:pb-6">
        <Outlet />
      </main>
      <ChatbotPanel />
      <ThemeToggle className="fixed top-4 right-4 z-[60]" />
    </div>
  );
}
