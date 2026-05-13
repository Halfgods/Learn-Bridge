import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Mail, Lock, Sparkles } from "lucide-react";
import { Blobs } from "@/components/Blobs";
import { ClayButton } from "@/components/ClayButton";
import { ClayInput } from "@/components/ClayInput";
import { MascotBadge } from "@/components/MascotBadge";
import { apiPath } from "@/lib/api";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in — Nova Learn" }, { name: "description", content: "Welcome back to Nova Learn." }] }),
  component: Login,
});

import { useState } from "react";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(apiPath("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      
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
