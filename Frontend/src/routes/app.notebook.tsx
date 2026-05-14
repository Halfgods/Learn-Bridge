import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/notebook")({
  head: () => ({ meta: [{ title: "Notebook — Nova Learn" }] }),
  component: () => <Outlet />,
});
