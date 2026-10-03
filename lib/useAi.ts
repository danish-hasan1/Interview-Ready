"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { AiStatus } from "./types";

export function useAi() {
  const [ai, setAi] = useState<AiStatus | null>(null);
  const refresh = useCallback(() => api<AiStatus>("/ai").then(setAi).catch(() => {}), []);
  useEffect(() => { refresh(); }, [refresh]);
  const on = (feature: string) => !!ai && ai.configured && ai.enabled && ai.consent && !!ai.features[feature];
  return { ai, refresh, on };
}
