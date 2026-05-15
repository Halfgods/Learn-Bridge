import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, Sparkles, GraduationCap, School } from "lucide-react";
import { Blobs } from "@/components/Blobs";
import { ClayButton } from "@/components/ClayButton";
import { ClayInput } from "@/components/ClayInput";
import { MascotBadge } from "@/components/MascotBadge";
import { apiPath, parseApiJson } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in — Nova Learn" }, { name: "description", content: "Welcome back to Nova Learn." }] }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"student" | "teacher">("student");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(apiPath("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, expectedRole: accountType })
      });
      const data = await parseApiJson<{ error?: string; token?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Login failed");
      if (!data.token) throw new Error("Login failed");

      localStorage.setItem("token", data.token);
      navigate({ to: "/app" });
    } catch (err: any) {
      setError(err.message);
    }
  };
  return (
    <div className="relative min-h-screen flex items-center justify-center p-6">
      <Blobs />
      <div className="w-full max-w-md clay-lg bg-card p-8 space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <MascotBadge size={96} />
          <h1 className="text-3xl font-black">Welcome back!</h1>
          <p className="text-muted-foreground text-sm">Log in to continue your learning journey</p>
        </div>
        <form className="space-y-4" onSubmit={handleLogin}>
          {error && <div className="text-sm font-bold text-destructive text-center">{error}</div>}
          <div>
            <p className="text-xs font-bold text-muted-foreground ml-2 mb-2">I am logging in as</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAccountType("student")}
                className={cn(
                  "h-14 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all clay-sm",
                  accountType === "student" ? "gradient-primary text-white glow-purple" : "bg-card hover:-translate-y-0.5",
                )}
              >
                <School className="w-4 h-4" /> Student
              </button>
              <button
                type="button"
                onClick={() => setAccountType("teacher")}
                className={cn(
                  "h-14 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all clay-sm",
                  accountType === "teacher" ? "gradient-cyan text-white glow-cyan" : "bg-card hover:-translate-y-0.5",
                )}
              >
                <GraduationCap className="w-4 h-4" /> Teacher
              </button>
            </div>
          </div>
          <ClayInput label="Email" type="email" placeholder="you@school.com" icon={<Mail className="w-4 h-4" />} required value={email} onChange={(e) => setEmail(e.target.value)} />
          <ClayInput label="Password" type="password" placeholder="••••••••" icon={<Lock className="w-4 h-4" />} required value={password} onChange={(e) => setPassword(e.target.value)} />
          <ClayButton type="submit" size="lg" className="w-full">Log in <Sparkles className="w-4 h-4" /></ClayButton>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/signup" className="font-bold text-primary">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
