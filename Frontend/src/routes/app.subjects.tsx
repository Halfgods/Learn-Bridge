import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { apiPath, parseApiJson } from "@/lib/api";
import { useMe } from "@/hooks/useMe";
import { getSubjectMeta } from "@/lib/subject-meta";

export const Route = createFileRoute("/app/subjects")({
  head: () => ({ meta: [{ title: "Subjects — Nova Learn" }] }),
  component: SubjectsPage,
});

function SubjectsPage() {
  const { data: user } = useMe();
  const grade = user?.grade ?? (user?.role === "teacher" ? 8 : undefined);
  const { data: names } = useQuery({
    queryKey: ["subjects", grade],
    queryFn: async () => {
      const res = await fetch(apiPath(`/api/curriculum/class/${grade}/subjects`));
      if (!res.ok) throw new Error("Failed");
      const data = await parseApiJson<{ subjects?: string[] }>(res);
      return data.subjects as string[];
    },
    enabled: grade != null,
    staleTime: Infinity,
  });

  const list =
    names && names.length
      ? names
      : ["Mathematics", "Science", "English", "Social Science"];

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-black">Subjects</h1>
        <p className="text-muted-foreground mt-1">
          {user?.role === "teacher"
            ? "Browse curriculum by subject — same chapters your students see."
            : "Pick a subject to continue learning."}
        </p>
      </header>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((name) => {
          const m = getSubjectMeta(name);
          const id = name.toLowerCase().replace(/\s+/g, "-");
          return (
            <Link
              key={name}
              to="/app/subject/$subjectId"
              params={{ subjectId: id }}
              className="clay-lg bg-card p-5 hover:-translate-y-1 transition-all group flex flex-col"
            >
              <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center clay-sm mb-4", m.gradient, m.text)}>
                <m.icon className="w-7 h-7" />
              </div>
              <h2 className={cn("font-extrabold text-lg", m.text)}>{name}</h2>
              <div className="mt-auto pt-4 flex items-center justify-between text-sm font-bold text-primary">
                Open <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
