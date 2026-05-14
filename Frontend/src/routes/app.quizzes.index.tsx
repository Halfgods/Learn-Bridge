import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Trophy,
  Clock,
  ArrowRight,
  ArrowLeft,
  Loader2,
  BarChart3,
  Medal,
  Sparkles,
  Brain,
  BookOpen,
  Calculator,
  Beaker,
  Globe2,
} from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { apiPath, parseApiJson } from "@/lib/api";
import { useMe } from "@/hooks/useMe";
import { ClayButton } from "@/components/ClayButton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/quizzes/")({
  head: () => ({ meta: [{ title: "Quizzes — Nova Learn" }] }),
  component: QuizzesHome,
});

type QuizRow = {
  quizId: string;
  title: string;
  subject: string;
  deadline: string;
  teacherName?: string;
  questionCount?: number;
  completed?: boolean;
  score?: number | null;
  total?: number | null;
};

type Achievements = {
  totalQuizzes: number;
  averageScore: number;
  bestScore: number;
  bestTotal: number;
  totalScore: number;
  maxScore: number;
  subjects: string[];
  recent: { quizId: string; title: string; score: number; total: number; submittedAt: string }[];
};

type TestQuestion = {
  q: string;
  options: string[];
  correct: number;
};

type SubjectTest = {
  subject: string;
  icon: typeof BookOpen;
  gradient: string;
  questions: TestQuestion[];
};

const subjectTests: SubjectTest[] = [
  {
    subject: "Mathematics",
    icon: Calculator,
    gradient: "gradient-primary",
    questions: [
      {
        q: "What is the value of π (pi) approximately?",
        options: ["3.14", "2.71", "1.62", "3.00"],
        correct: 0,
      },
      { q: "What is 15% of 200?", options: ["20", "30", "25", "35"], correct: 1 },
      { q: "Solve: 2x + 5 = 15. What is x?", options: ["5", "10", "7", "3"], correct: 0 },
      {
        q: "What is the area of a circle with radius 7 cm? (Use π = 22/7)",
        options: ["154 cm²", "144 cm²", "164 cm²", "174 cm²"],
        correct: 0,
      },
      { q: "What is the square root of 144?", options: ["11", "12", "13", "14"], correct: 1 },
      {
        q: "If a triangle has angles 90°, 45°, 45°, what type is it?",
        options: ["Equilateral", "Isosceles right", "Scalene", "Obtuse"],
        correct: 1,
      },
      { q: "What is the LCM of 12 and 18?", options: ["24", "36", "48", "72"], correct: 1 },
      { q: "Simplify: 3/4 + 1/2", options: ["1", "5/4", "4/6", "2/3"], correct: 1 },
      {
        q: "What is the volume of a cube with side 5 cm?",
        options: ["125 cm³", "25 cm³", "100 cm³", "150 cm³"],
        correct: 0,
      },
      { q: "Which number is prime?", options: ["15", "21", "17", "27"], correct: 2 },
      {
        q: "What is the perimeter of a rectangle 8 cm by 5 cm?",
        options: ["26 cm", "40 cm", "13 cm", "20 cm"],
        correct: 0,
      },
      {
        q: "If a:b = 2:3 and b:c = 4:5, find a:c",
        options: ["8:15", "2:5", "6:8", "10:12"],
        correct: 0,
      },
      { q: "What is the mode of: 2, 3, 5, 3, 7, 3?", options: ["2", "3", "5", "7"], correct: 1 },
      { q: "Solve: 5² + 3³ = ?", options: ["34", "52", "25", "27"], correct: 1 },
      { q: "What is the HCF of 24 and 36?", options: ["6", "12", "8", "18"], correct: 1 },
      {
        q: "A train travels 120 km in 2 hours. What is its speed?",
        options: ["60 km/h", "50 km/h", "70 km/h", "40 km/h"],
        correct: 0,
      },
      { q: "What is the median of: 4, 7, 2, 9, 5?", options: ["4", "5", "7", "6"], correct: 1 },
      { q: "If x - 3 = 7, what is 2x + 1?", options: ["21", "15", "19", "17"], correct: 0 },
      {
        q: "How many degrees are in a straight angle?",
        options: ["90°", "180°", "270°", "360°"],
        correct: 1,
      },
      {
        q: "What is the probability of rolling a 6 on a fair die?",
        options: ["1/2", "1/3", "1/6", "1/4"],
        correct: 2,
      },
    ],
  },
  {
    subject: "Science",
    icon: Beaker,
    gradient: "gradient-cyan",
    questions: [
      {
        q: "What is the chemical symbol for water?",
        options: ["H2O", "CO2", "NaCl", "O2"],
        correct: 0,
      },
      {
        q: "Which planet is known as the Red Planet?",
        options: ["Venus", "Mars", "Jupiter", "Saturn"],
        correct: 1,
      },
      {
        q: "What is the largest organ in the human body?",
        options: ["Liver", "Brain", "Skin", "Heart"],
        correct: 2,
      },
      {
        q: "What gas do plants absorb from the atmosphere?",
        options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"],
        correct: 2,
      },
      {
        q: "What is the SI unit of force?",
        options: ["Joule", "Newton", "Pascal", "Watt"],
        correct: 1,
      },
      {
        q: "What is the boiling point of water at sea level?",
        options: ["90°C", "100°C", "110°C", "120°C"],
        correct: 1,
      },
      {
        q: "Which vitamin is produced when skin is exposed to sunlight?",
        options: ["Vitamin A", "Vitamin B", "Vitamin C", "Vitamin D"],
        correct: 3,
      },
      {
        q: "What is the speed of light approximately?",
        options: ["3×10⁶ m/s", "3×10⁸ m/s", "3×10¹⁰ m/s", "3×10⁴ m/s"],
        correct: 1,
      },
      { q: "What is the pH of pure water?", options: ["5", "6", "7", "8"], correct: 2 },
      {
        q: "Which element has the atomic number 1?",
        options: ["Helium", "Lithium", "Hydrogen", "Carbon"],
        correct: 2,
      },
      {
        q: "What type of energy does a moving object have?",
        options: ["Potential", "Kinetic", "Thermal", "Chemical"],
        correct: 1,
      },
      {
        q: "What is the main gas in Earth's atmosphere?",
        options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Argon"],
        correct: 2,
      },
      {
        q: "How many bones are in the adult human body?",
        options: ["106", "206", "306", "406"],
        correct: 1,
      },
      {
        q: "What force keeps planets orbiting the Sun?",
        options: ["Magnetic", "Centrifugal", "Gravity", "Friction"],
        correct: 2,
      },
      {
        q: "What is the chemical formula of common salt?",
        options: ["KCl", "NaCl", "CaCl2", "MgCl2"],
        correct: 1,
      },
      {
        q: "Which part of the plant conducts photosynthesis?",
        options: ["Root", "Stem", "Leaf", "Flower"],
        correct: 2,
      },
      {
        q: "What is the unit of electric current?",
        options: ["Volt", "Ampere", "Ohm", "Watt"],
        correct: 1,
      },
      {
        q: "What is the freezing point of water in Celsius?",
        options: ["0°C", "-1°C", "1°C", "4°C"],
        correct: 0,
      },
      {
        q: "Which blood cells fight infections?",
        options: ["Red blood cells", "Platelets", "White blood cells", "Plasma"],
        correct: 2,
      },
      {
        q: "What is the hardest natural substance?",
        options: ["Gold", "Iron", "Diamond", "Quartz"],
        correct: 2,
      },
    ],
  },
  {
    subject: "English",
    icon: BookOpen,
    gradient: "gradient-yellow",
    questions: [
      {
        q: "What is the past tense of 'go'?",
        options: ["Goed", "Went", "Gone", "Going"],
        correct: 1,
      },
      {
        q: "Which word is a synonym for 'happy'?",
        options: ["Sad", "Angry", "Joyful", "Tired"],
        correct: 2,
      },
      {
        q: "Identify the noun in: 'The boy ran fast.'",
        options: ["The", "Ran", "Boy", "Fast"],
        correct: 2,
      },
      {
        q: "What is the plural of 'child'?",
        options: ["Childs", "Childes", "Children", "Childrens"],
        correct: 2,
      },
      {
        q: "Which is a complete sentence?",
        options: ["Running fast", "The dog barks", "In the morning", "Under the table"],
        correct: 1,
      },
      {
        q: "What part of speech describes a verb?",
        options: ["Noun", "Adjective", "Adverb", "Pronoun"],
        correct: 2,
      },
      {
        q: "Which word is an antonym of 'dark'?",
        options: ["Light", "Bright", "Both", "Night"],
        correct: 2,
      },
      {
        q: "Identify the preposition: 'The cat is under the table.'",
        options: ["Cat", "Is", "Under", "Table"],
        correct: 2,
      },
      {
        q: "What is the comparative form of 'good'?",
        options: ["Gooder", "Better", "Best", "More good"],
        correct: 1,
      },
      {
        q: "Which sentence uses correct punctuation?",
        options: ["Whats your name", "What's your name", "Whats your name?", "whats your name"],
        correct: 1,
      },
      {
        q: "What is the main verb in: 'She has been singing.'?",
        options: ["Has", "Been", "Singing", "She"],
        correct: 2,
      },
      {
        q: "Which is a compound word?",
        options: ["Happy", "Sunshine", "Running", "Quickly"],
        correct: 1,
      },
      {
        q: "Identify the adjective: 'The beautiful flowers bloom.'",
        options: ["The", "Beautiful", "Flowers", "Bloom"],
        correct: 1,
      },
      {
        q: "What tense is: 'They will arrive tomorrow.'?",
        options: ["Past", "Present", "Future", "Present continuous"],
        correct: 2,
      },
      { q: "Which word is a conjunction?", options: ["And", "Run", "Blue", "Quickly"], correct: 0 },
      {
        q: "What is the opposite of 'ancient'?",
        options: ["Old", "Modern", "Historic", "Aged"],
        correct: 1,
      },
      {
        q: "Which is a proper noun?",
        options: ["City", "London", "River", "Mountain"],
        correct: 1,
      },
      {
        q: "What does the prefix 'un-' mean?",
        options: ["Again", "Before", "Not", "Under"],
        correct: 2,
      },
      {
        q: "Which is the correct spelling?",
        options: ["Recieve", "Receive", "Receeve", "Receve"],
        correct: 1,
      },
      {
        q: "What is a group of lions called?",
        options: ["Flock", "Herd", "Pride", "Pack"],
        correct: 2,
      },
    ],
  },
  {
    subject: "Social Science",
    icon: Globe2,
    gradient: "gradient-peach",
    questions: [
      {
        q: "Which is the largest continent by area?",
        options: ["Africa", "Asia", "North America", "Europe"],
        correct: 1,
      },
      {
        q: "Who was the first President of India?",
        options: ["Mahatma Gandhi", "Jawaharlal Nehru", "Dr. Rajendra Prasad", "Sardar Patel"],
        correct: 2,
      },
      {
        q: "What is the capital of France?",
        options: ["London", "Berlin", "Paris", "Madrid"],
        correct: 2,
      },
      {
        q: "Which ocean is the largest?",
        options: ["Atlantic", "Indian", "Arctic", "Pacific"],
        correct: 3,
      },
      {
        q: "In which year did India gain independence?",
        options: ["1945", "1946", "1947", "1948"],
        correct: 2,
      },
      {
        q: "What is the main purpose of the United Nations?",
        options: ["Trade", "Peace", "Sports", "Culture"],
        correct: 1,
      },
      {
        q: "Which river is the longest in the world?",
        options: ["Amazon", "Nile", "Mississippi", "Yangtze"],
        correct: 1,
      },
      {
        q: "What type of government does India have?",
        options: ["Monarchy", "Dictatorship", "Democracy", "Theocracy"],
        correct: 2,
      },
      {
        q: "Which mountain range separates Europe from Asia?",
        options: ["Himalayas", "Andes", "Alps", "Urals"],
        correct: 3,
      },
      {
        q: "Who wrote the Indian Constitution?",
        options: ["Nehru", "Ambedkar", "Gandhi", "Patel"],
        correct: 1,
      },
      {
        q: "What is the currency of Japan?",
        options: ["Yuan", "Won", "Yen", "Ringgit"],
        correct: 2,
      },
      {
        q: "Which animal is the national symbol of India?",
        options: ["Tiger", "Lion", "Elephant", "Peacock"],
        correct: 0,
      },
      {
        q: "What is a democracy?",
        options: ["Rule by one person", "Rule by the people", "Rule by army", "Rule by king"],
        correct: 1,
      },
      {
        q: "Which country has the largest population?",
        options: ["USA", "China", "India", "Indonesia"],
        correct: 2,
      },
      {
        q: "What is the Earth's primary source of energy?",
        options: ["Moon", "Sun", "Stars", "Wind"],
        correct: 1,
      },
      {
        q: "Who discovered the sea route to India?",
        options: ["Columbus", "Magellan", "Vasco da Gama", "Cook"],
        correct: 2,
      },
      {
        q: "Which is not a fundamental right in India?",
        options: [
          "Right to Equality",
          "Right to Property",
          "Right to Freedom",
          "Right to Education",
        ],
        correct: 1,
      },
      {
        q: "What causes seasons on Earth?",
        options: ["Distance from Sun", "Earth's tilt", "Moon's gravity", "Ocean currents"],
        correct: 1,
      },
      {
        q: "Which country is known as the Land of the Rising Sun?",
        options: ["China", "Korea", "Japan", "Thailand"],
        correct: 2,
      },
      {
        q: "What is the minimum voting age in India?",
        options: ["16", "17", "18", "21"],
        correct: 2,
      },
    ],
  },
];

function QuizzesHome() {
  const navigate = useNavigate();
  const { data: user, isLoading: meLoading } = useMe();
  const isTeacher = user?.role === "teacher";
  const [activeTest, setActiveTest] = useState<string | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [testResult, setTestResult] = useState<{ score: number; total: number } | null>(null);

  const teacherQ = useQuery({
    queryKey: ["teacher-quizzes"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch(apiPath("/api/teacher/quizzes"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseApiJson<{ quizzes: QuizRow[] }>(res);
      if (!res.ok) throw new Error("Failed");
      return data.quizzes;
    },
    enabled: !!user && isTeacher,
  });

  const studentQ = useQuery({
    queryKey: ["student-quiz-assignments"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch(apiPath("/api/student/quiz-assignments"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseApiJson<{
        assignments: QuizRow[];
        pendingCount?: number;
      }>(res);
      if (!res.ok) throw new Error("Failed");
      return data.assignments;
    },
    enabled: !!user && !isTeacher,
  });

  const achievementsQ = useQuery({
    queryKey: ["student-achievements"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch(apiPath("/api/student/achievements"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      return parseApiJson<Achievements>(res);
    },
    enabled: !!user && !isTeacher,
  });

  if (meLoading || !user) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  const rawRows = isTeacher ? teacherQ.data : studentQ.data;
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const pending = isTeacher ? teacherQ.isLoading : studentQ.isLoading;
  const err = isTeacher ? teacherQ.error : studentQ.error;

  const currentTest = subjectTests.find((t) => t.subject === activeTest);

  const startTest = (subject: string) => {
    setActiveTest(subject);
    setAnswers([]);
    setTestResult(null);
  };

  const submitTest = () => {
    if (!currentTest) return;
    const score = answers.reduce(
      (s, a, i) => s + (a === currentTest.questions[i].correct ? 1 : 0),
      0,
    );
    setTestResult({ score, total: currentTest.questions.length });
    localStorage.setItem(
      `test-result-${currentTest.subject}`,
      JSON.stringify({ score, total: currentTest.questions.length }),
    );
  };

  if (activeTest && currentTest) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6">
        <button
          onClick={() => {
            setActiveTest(null);
            setTestResult(null);
          }}
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> All quizzes
        </button>

        <header className="flex items-center gap-4">
          <div
            className={cn(
              "h-14 w-14 rounded-2xl flex items-center justify-center clay-sm",
              currentTest.gradient,
              "text-white",
            )}
          >
            <currentTest.icon className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black">{currentTest.subject} Test</h1>
            <p className="text-muted-foreground font-bold text-sm">20 questions · 20 marks</p>
          </div>
        </header>

        {testResult ? (
          <div className="clay-lg bg-card p-8 text-center space-y-4">
            <div
              className={cn(
                "text-6xl font-black",
                testResult.score >= 14
                  ? "text-emerald-500"
                  : testResult.score >= 10
                    ? "text-amber-500"
                    : "text-rose-500",
              )}
            >
              {testResult.score}/{testResult.total}
            </div>
            <p className="text-xl font-bold">
              {testResult.score >= 14
                ? "Great job! 🎉"
                : testResult.score >= 10
                  ? "Good effort!"
                  : "Keep practicing!"}
            </p>
            <p className="text-muted-foreground font-medium">
              {Math.round((testResult.score / testResult.total) * 100)}% correct
            </p>
            <div className="flex gap-3 justify-center pt-4">
              <ClayButton onClick={() => startTest(currentTest.subject)}>Retry</ClayButton>
              <ClayButton
                variant="white"
                onClick={() => {
                  setActiveTest(null);
                  setTestResult(null);
                }}
              >
                Back to quizzes
              </ClayButton>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {currentTest.questions.map((q, qi) => (
              <div key={qi} className="clay-lg bg-card p-5 space-y-3">
                <p className="font-extrabold text-sm">
                  <span className="text-primary">{qi + 1}.</span> {q.q}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() =>
                        setAnswers((prev) => {
                          const next = [...prev];
                          next[qi] = oi;
                          return next;
                        })
                      }
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                        answers[qi] === oi
                          ? "border-primary bg-primary/10 font-bold"
                          : "border-muted bg-background hover:border-muted-foreground/30 font-medium",
                      )}
                    >
                      <span
                        className={cn(
                          "h-6 w-6 rounded-full flex items-center justify-center text-xs font-black shrink-0",
                          answers[qi] === oi
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {String.fromCharCode(65 + oi)}
                      </span>
                      <span className="text-sm">{opt}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <ClayButton
                size="lg"
                onClick={submitTest}
                disabled={
                  answers.filter((a) => a !== undefined).length < currentTest.questions.length
                }
                className="flex-1"
              >
                Submit ({answers.filter((a) => a !== undefined).length}/
                {currentTest.questions.length} answered)
              </ClayButton>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Quizzes</h1>
          <p className="text-muted-foreground mt-1">
            {isTeacher
              ? "Build quick checks for your class — like a simple form, with a clear deadline."
              : "Teacher quizzes and subject-wise practice tests."}
          </p>
        </div>
        {isTeacher && (
          <ClayButton
            size="lg"
            onClick={() => navigate({ to: "/app/quizzes/new" })}
            className="shrink-0"
          >
            <Plus className="w-4 h-4" /> New quiz
          </ClayButton>
        )}
      </div>

      {/* Student: Subject Tests */}
      {!isTeacher && (
        <section>
          <h2 className="text-xl font-extrabold mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> Subject Tests
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {subjectTests.map((test) => {
              const stored = localStorage.getItem(`test-result-${test.subject}`);
              const prev = stored ? JSON.parse(stored) : null;
              return (
                <button
                  key={test.subject}
                  onClick={() => startTest(test.subject)}
                  className="clay-lg bg-card p-5 text-left hover:-translate-y-0.5 transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={cn(
                        "h-12 w-12 rounded-2xl flex items-center justify-center clay-sm",
                        test.gradient,
                        "text-white",
                      )}
                    >
                      <test.icon className="w-6 h-6" />
                    </div>
                    {prev && (
                      <span
                        className={cn(
                          "text-xs font-black px-2 py-1 rounded-full",
                          prev.score >= 14
                            ? "bg-emerald-500/15 text-emerald-600"
                            : "bg-amber-500/15 text-amber-600",
                        )}
                      >
                        {prev.score}/{prev.total}
                      </span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-lg">{test.subject}</h3>
                  <p className="text-xs text-muted-foreground font-bold mt-1">20 MCQ · 20 marks</p>
                  <div className="mt-3 flex items-center gap-2 text-sm font-bold text-primary">
                    {prev ? "Retry test" : "Start test"}{" "}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Student: Teacher quizzes */}
      {!isTeacher && (
        <section>
          <h2 className="text-xl font-extrabold mb-4">Teacher Quizzes</h2>

          {achievementsQ.data && achievementsQ.data.totalQuizzes > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                {
                  icon: Trophy,
                  label: "Completed",
                  value: achievementsQ.data.totalQuizzes,
                  color: "text-clay-yellow",
                },
                {
                  icon: Brain,
                  label: "Avg Score",
                  value: `${achievementsQ.data.averageScore}%`,
                  color: "text-cyan-400",
                },
                {
                  icon: Medal,
                  label: "Best",
                  value: `${achievementsQ.data.bestScore}/${achievementsQ.data.bestTotal}`,
                  color: "text-emerald-400",
                },
                {
                  icon: BookOpen,
                  label: "Subjects",
                  value: achievementsQ.data.subjects.length,
                  color: "text-primary",
                },
              ].map((s) => (
                <div key={s.label} className="clay-lg bg-card p-4 text-center space-y-1">
                  <s.icon className={cn("w-5 h-5 mx-auto", s.color)} />
                  <div className="text-2xl font-black">{s.value}</div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {pending && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
          {err && (
            <p className="text-destructive font-bold text-center text-sm">
              Could not load teacher quizzes.
            </p>
          )}

          {!pending && rows.length === 0 && (
            <p className="text-sm text-muted-foreground font-bold">
              No teacher quizzes assigned for your class.
            </p>
          )}

          <ul className="space-y-2">
            {rows.map((q) => {
              let closed = false;
              try {
                closed = isPast(parseISO(q.deadline));
              } catch {
                closed = false;
              }
              return (
                <li key={q.quizId}>
                  <Link
                    to="/app/quizzes/$quizId"
                    params={{ quizId: q.quizId }}
                    className="flex items-center gap-3 clay-sm bg-card p-3 rounded-2xl hover:bg-muted/50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-xl gradient-primary clay-sm flex items-center justify-center text-white shrink-0">
                      <Trophy className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate flex items-center gap-2">
                        {q.title}
                        {q.completed && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">
                            Done{" "}
                            {q.score != null && q.total != null ? `· ${q.score}/${q.total}` : ""}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-bold truncate">
                        {q.subject}
                        {q.teacherName ? ` · ${q.teacherName}` : ""}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "text-xs font-bold flex items-center gap-1 shrink-0",
                        closed ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      <Clock className="w-3 h-3" />
                      {q.deadline ? format(parseISO(q.deadline), "MMM d") : "—"}
                    </div>
                    <ArrowRight className="w-4 h-4 text-primary shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Teacher view */}
      {isTeacher && (
        <section>
          {pending && (
            <div className="flex justify-center py-16">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
          )}
          {err && <p className="text-destructive font-bold text-center">Could not load quizzes.</p>}

          {!pending && rows.length === 0 && (
            <div className="clay-lg bg-card p-10 text-center space-y-3">
              <Trophy className="w-12 h-12 mx-auto text-clay-yellow" />
              <p className="font-bold">No quizzes yet — create your first one!</p>
              <ClayButton onClick={() => navigate({ to: "/app/quizzes/new" })}>
                Create quiz
              </ClayButton>
            </div>
          )}

          <ul className="space-y-3">
            {rows.map((q) => {
              let closed = false;
              try {
                closed = isPast(parseISO(q.deadline));
              } catch {
                closed = false;
              }
              return (
                <li key={q.quizId} className="space-y-2">
                  <Link
                    to="/app/quizzes/$quizId"
                    params={{ quizId: q.quizId }}
                    className="clay-lg bg-card p-5 flex flex-wrap items-center gap-4 hover:-translate-y-0.5 transition-all group"
                  >
                    <div className="h-12 w-12 rounded-2xl gradient-primary clay-sm flex items-center justify-center text-white shrink-0">
                      <Trophy className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-extrabold text-lg">{q.title}</div>
                      <div className="text-sm text-muted-foreground font-bold">
                        {q.subject}
                        {typeof q.questionCount === "number"
                          ? ` · ${q.questionCount} questions`
                          : ""}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "text-sm font-bold flex items-center gap-2",
                        closed ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      <Clock className="w-4 h-4" />
                      {closed ? "Closed · " : "Due "}
                      {q.deadline ? format(parseISO(q.deadline), "MMM d, h:mm a") : "—"}
                    </div>
                    <ArrowRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform shrink-0" />
                  </Link>
                  <div className="pl-4">
                    <Link
                      to="/app/quizzes/$quizId/results"
                      params={{ quizId: q.quizId }}
                      className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
                    >
                      <BarChart3 className="w-4 h-4" /> View class results
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
