"use client";

import { useState, useEffect, useCallback } from "react";
import type { EnvironmentSpec } from "@/lib/types";

export interface Environment {
  id: string;
  name: string;
  version: number;
  createdAt: string;
}

export interface Config {
  id: string;
  environmentId: string;
  name: string;
  spec: EnvironmentSpec;
  createdAt: string;
}

export interface Run {
  id: string;
  configId: string;
  prompt: string | null;
  status: "running" | "complete" | "stopped";
  createdAt: string;
}

export function useEnvironments() {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [activeEnvId, setActiveEnvId] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Config[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch environments
  useEffect(() => {
    fetch("/api/environments")
      .then((r) => r.json())
      .then((data) => {
        const envs = data.map((d: Record<string, unknown>) => ({
          id: d.id as string,
          name: d.name as string,
          version: (d.version as number) ?? 1,
          createdAt: d.created_at as string,
        }));
        setEnvironments(envs);
        if (envs.length > 0 && !activeEnvId) {
          setActiveEnvId(envs[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch configs when env changes
  useEffect(() => {
    if (!activeEnvId) { setConfigs([]); return; }
    fetch(`/api/environments/${activeEnvId}/configs`)
      .then((r) => r.json())
      .then((data) => {
        const cfgs = data.map((d: Record<string, unknown>) => ({
          id: d.id as string,
          environmentId: d.environment_id as string,
          name: d.name as string,
          spec: d.spec as EnvironmentSpec,
          createdAt: d.created_at as string,
        }));
        setConfigs(cfgs);
        setActiveConfigId(cfgs.length > 0 ? cfgs[0].id : null);
      });
  }, [activeEnvId]);

  // Fetch runs when config changes
  useEffect(() => {
    if (!activeConfigId) { setRuns([]); return; }
    fetch(`/api/configs/${activeConfigId}/runs`)
      .then((r) => r.json())
      .then((data) => {
        setRuns(
          data.map((d: Record<string, unknown>) => ({
            id: d.id as string,
            configId: d.config_id as string,
            prompt: d.prompt as string | null,
            status: d.status as string,
            createdAt: d.created_at as string,
          })),
        );
      });
  }, [activeConfigId]);

  const createEnvironment = useCallback(async (name: string) => {
    const res = await fetch("/api/environments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.id) {
      const env = { id: data.id, name: data.name, version: data.version ?? 1, createdAt: data.created_at };
      setEnvironments((prev) => [env, ...prev]);
      setActiveEnvId(data.id);
    }
    return data;
  }, []);

  const deleteEnvironment = useCallback(async (id: string) => {
    await fetch(`/api/environments/${id}`, { method: "DELETE" });
    setEnvironments((prev) => prev.filter((e) => e.id !== id));
    if (activeEnvId === id) {
      setActiveEnvId(null);
    }
  }, [activeEnvId]);

  const saveConfig = useCallback(async (name: string, spec: EnvironmentSpec) => {
    if (!activeEnvId) return null;
    const res = await fetch(`/api/environments/${activeEnvId}/configs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, spec }),
    });
    const data = await res.json();
    if (data.id) {
      const cfg: Config = {
        id: data.id,
        environmentId: data.environment_id,
        name: data.name,
        spec: data.spec,
        createdAt: data.created_at,
      };
      setConfigs((prev) => [cfg, ...prev]);
      setActiveConfigId(data.id);
      return cfg;
    }
    return null;
  }, [activeEnvId]);

  const deleteConfig = useCallback(async (configId: string) => {
    if (!activeEnvId) return;
    await fetch(`/api/environments/${activeEnvId}/configs/${configId}`, { method: "DELETE" });
    setConfigs((prev) => prev.filter((c) => c.id !== configId));
    if (activeConfigId === configId) setActiveConfigId(null);
  }, [activeEnvId, activeConfigId]);

  const refreshRuns = useCallback(async () => {
    if (!activeConfigId) return;
    const res = await fetch(`/api/configs/${activeConfigId}/runs`);
    const data = await res.json();
    setRuns(
      data.map((d: Record<string, unknown>) => ({
        id: d.id as string,
        configId: d.config_id as string,
        prompt: d.prompt as string | null,
        status: d.status as string,
        createdAt: d.created_at as string,
      })),
    );
  }, [activeConfigId]);

  const activeEnv = environments.find((e) => e.id === activeEnvId) ?? null;
  const activeConfig = configs.find((c) => c.id === activeConfigId) ?? null;

  return {
    environments,
    activeEnv,
    activeEnvId,
    setActiveEnvId,
    configs,
    activeConfig,
    activeConfigId,
    setActiveConfigId,
    runs,
    loading,
    createEnvironment,
    deleteEnvironment,
    saveConfig,
    deleteConfig,
    refreshRuns,
  };
}
