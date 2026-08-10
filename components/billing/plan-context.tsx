"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface PlanState {
  plan: "free" | "pro";
  email?: string;
  periodEnd?: number;
  loading: boolean;
  /** Call this to force a re-fetch (e.g. after checkout success redirect). */
  refresh: () => Promise<void>;
}

const DEFAULTS: PlanState = {
  plan: "free",
  loading: true,
  refresh: async () => {},
};

const PlanCtx = createContext<PlanState>(DEFAULTS);

/**
 * Lightweight client-side provider. Fetches /api/plan once on mount
 * and exposes the plan to any client component via usePlan().
 *
 * The cookie is httpOnly so client code cannot parse it directly;
 * this API call is the single authoritative source.
 *
 * Mount this ONCE near the app root (e.g. inside SiteHeader wrapper
 * or the home/pricing page bodies). Fine to mount in multiple places
 * (e.g. every page) — fetch is small and cached via browser memo.
 */
export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PlanState>(DEFAULTS);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/plan", {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const json = (await res.json()) as Partial<PlanState>;
      setState({
        plan: json.plan === "pro" ? "pro" : "free",
        email: json.email,
        periodEnd: json.periodEnd,
        loading: false,
        refresh: async () => {
          /* overridden below */
        },
      });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Attach refresh() into the returned object so usePlan().refresh() works.
  const value = useMemo<PlanState>(
    () => ({
      plan: state.plan,
      email: state.email,
      periodEnd: state.periodEnd,
      loading: state.loading,
      refresh,
    }),
    [state.plan, state.email, state.periodEnd, state.loading, refresh]
  );

  return <PlanCtx.Provider value={value}>{children}</PlanCtx.Provider>;
}

export function usePlan(): PlanState {
  return useContext(PlanCtx);
}
