import { useQuery } from "@tanstack/react-query";
import { apiPath, parseApiJson } from "@/lib/api";

export type MeUser = {
  name?: string;
  email?: string;
  grade?: number | null;
  board?: string | null;
  role?: "student" | "teacher";
  createdAt?: string;
};

async function fetchMe(): Promise<MeUser> {
  if (typeof window === "undefined") throw new Error("No token");
  const token = localStorage.getItem("token");
  if (!token) throw new Error("No token");
  const res = await fetch(apiPath("/api/auth/me"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseApiJson<{ user?: MeUser; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || "Unauthorized");
  return data.user as MeUser;
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    retry: false,
    staleTime: 60_000,
    enabled: typeof window !== "undefined",
  });
}
