"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { BucketCategory, BucketItem } from "@/lib/types";

export function useBucket() {
  const [items, setItems] = useState<BucketItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/bucket")
      .then((r) => r.json())
      .then((data) => {
        setItems(
          data.map((d: { id: string; category: string; label: string; created_at: string }) => ({
            id: d.id,
            category: d.category as BucketCategory,
            label: d.label,
            createdAt: d.created_at,
          })),
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const addItem = useCallback(async (category: BucketCategory, label: string) => {
    const res = await fetch("/api/bucket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, label }),
    });
    const data = await res.json();
    if (data.id) {
      setItems((prev) => [
        ...prev,
        { id: data.id, category: data.category, label: data.label, createdAt: data.created_at },
      ]);
    }
  }, []);

  const updateItem = useCallback(async (id: string, label: string) => {
    await fetch(`/api/bucket/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, label } : i)));
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    await fetch(`/api/bucket/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const grouped = useMemo(
    () => ({
      rules: items.filter((i) => i.category === "rule"),
      skills: items.filter((i) => i.category === "skill"),
      values: items.filter((i) => i.category === "value"),
      tools: items.filter((i) => i.category === "tool"),
    }),
    [items],
  );

  return { items, grouped, loading, addItem, updateItem, deleteItem };
}
