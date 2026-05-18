import {
  Calculator, Beaker, BookOpen, Globe2, Cpu, Languages,
  Atom, FlaskConical, Dna, Microscope, Heart, Building2,
  BarChart3, Factory, Palette, Music, Map, History,
  Home, Server, Brain, Scale, School, Tent, TrendingUp,
  type LucideIcon,
} from "lucide-react";

export type SubjectMeta = {
  icon: LucideIcon;
  gradient: string;
  text: string;
};

const gradients = [
  "gradient-primary", "gradient-cyan", "gradient-yellow",
  "gradient-peach", "gradient-mint", "gradient-rose",
  "gradient-violet", "gradient-orange", "gradient-teal",
  "gradient-indigo", "gradient-pink", "gradient-lime",
];

const textColors = [
  "text-white", "text-white", "text-amber-900",
  "text-orange-900", "text-emerald-900", "text-rose-900",
  "text-violet-900", "text-orange-900", "text-teal-900",
  "text-indigo-900", "text-pink-900", "text-lime-900",
];

const subjectIcons: Record<string, LucideIcon> = {
  Mathematics: Calculator,
  Science: Beaker,
  English: BookOpen,
  "Social Science": Globe2,
  "The World Around Us": Globe2,
  Computer: Cpu,
  "Computer Science": Cpu,
  Languages: Languages,
  "Environmental Studies": Globe2,
  Physics: Atom,
  Chemistry: FlaskConical,
  Biology: Dna,
  Biotechnology: Microscope,
  "Health and Physical Education": Heart,
  "Physical Education and Well Being": Heart,
  Accountancy: BarChart3,
  "Business Studies": Building2,
  Economics: TrendingUp,
  "Fine Art": Palette,
  "Knowledge Traditions Practices of India": BookOpen,
  Geography: Map,
  History: History,
  "Home Science": Home,
  "Informatics Practices": Server,
  "Skill Education": School,
  "Vocational Education": Factory,
  Political Science: Scale,
  Psychology: Brain,
  Sociology: Tent,
  Arts: Palette,
  Hindi: Languages,
  Urdu: Languages,
};

const iconList = Object.values(
  { Calculator, Beaker, BookOpen, Globe2, Cpu, Languages, Atom, FlaskConical, Dna, Microscope, Heart, Building2, BarChart3, Factory, Palette, Music, Map, History, Home, Server, Brain, Scale, School, Tent, TrendingUp }
);

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function getSubjectMeta(name: string, index?: number): SubjectMeta {
  const icon = subjectIcons[name] || iconList[hashStr(name) % iconList.length];
  const idx = index ?? hashStr(name) % gradients.length;
  return {
    icon,
    gradient: gradients[idx % gradients.length],
    text: textColors[idx % textColors.length],
  };
}
