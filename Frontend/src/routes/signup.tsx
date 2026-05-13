import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, User, GraduationCap, ArrowRight } from "lucide-react";
import { Blobs } from "@/components/Blobs";
import { ClayButton } from "@/components/ClayButton";
import { ClayInput } from "@/components/ClayInput";
import { MascotBadge } from "@/components/MascotBadge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign up — Nova Learn" }, { name: "description", content: "Create your free Nova Learn account." }] }),
  component: Signup,
});

function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [board, setBoard] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const next = async () => {
    if (step === 1 && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setError(null);

    if (step < 2) {
      setStep(step + 1);
    } else {
      try {
        const res = await fetch("http://127.0.0.1:5000/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password, grade, board })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Registration failed");

        localStorage.setItem("token", data.token);
        navigate({ to: "/assessment" });
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6">
      <Blobs />
      <div className="w-full max-w-lg clay-lg bg-card p-8 space-y-6">
        {/* Progress */}
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cn("h-2 flex-1 rounded-full transition-all", i <= step ? "gradient-primary" : "bg-muted")} />
          ))}
        </div>

        <div className="flex items-start gap-4">
          <MascotBadge size={72} float={false} />
          <div className="flex-1">
            <h1 className="text-2xl font-black">
              {step === 0 && "Let's get to know you"}
              {step === 1 && "Secure your account"}
              {step === 2 && "Tell us about school"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {step === 0 && '"Every expert was once a beginner." 🌱'}
              {step === 1 && "Pick a strong password — we'll keep it safe."}
              {step === 2 && "We'll personalize lessons for your board & class."}
            </p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); next(); }}>
          {error && <div className="text-sm font-bold text-destructive text-center">{error}</div>}
          {step === 0 && (
            <>
              <ClayInput label="Full name" placeholder="Your Name" icon={<User className="w-4 h-4" />} required value={name} onChange={(e) => setName(e.target.value)} />
              <ClayInput label="Email" type="email" placeholder="example@email.com" icon={<Mail className="w-4 h-4" />} required value={email} onChange={(e) => setEmail(e.target.value)} />
            </>
          )}
          {step === 1 && (
            <>
              <ClayInput label="Password" type="password" placeholder="At least 8 characters" icon={<Lock className="w-4 h-4" />} required value={password} onChange={(e) => setPassword(e.target.value)} />
              <ClayInput label="Confirm password" type="password" placeholder="Repeat password" icon={<Lock className="w-4 h-4" />} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </>
          )}
          {step === 2 && (
            <>
              <div>
                <label className="text-sm font-bold text-foreground/80 ml-2">Class / Grade</label>
                <div className="grid grid-cols-5 gap-2 mt-2">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((g) => (
                    <button
                      type="button"
                      key={g}
                      onClick={() => setGrade(g)}
                      className={cn(
                        "h-12 rounded-2xl font-bold transition-all",
                        grade === g ? "gradient-primary text-white glow-purple" : "clay-sm bg-card hover:-translate-y-0.5"
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-foreground/80 ml-2">Education board</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {["CBSE", "ICSE", "IB", "State Board"].map((b) => (
                    <button
                      type="button"
                      key={b}
                      onClick={() => setBoard(b)}
                      className={cn(
                        "h-14 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all",
                        board === b ? "gradient-cyan text-white" : "clay-sm bg-card hover:-translate-y-0.5"
                      )}
                    >
                      <GraduationCap className="w-4 h-4" /> {b}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <ClayButton type="button" variant="white" size="lg" className="flex-1" onClick={() => setStep(step - 1)}>
                Back
              </ClayButton>
            )}
            <ClayButton type="submit" size="lg" className="flex-1">
              {step < 2 ? "Continue" : "Take quick assessment"} <ArrowRight className="w-4 h-4" />
            </ClayButton>
          </div>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-primary">Log in</Link>
        </p>
      </div>
    </div>
  );
}
