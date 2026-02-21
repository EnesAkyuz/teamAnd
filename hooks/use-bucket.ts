"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { BucketCategory, BucketItem } from "@/lib/types";

interface RawBucketItem {
  id: string;
  category: string;
  label: string;
  content: string | null;
  created_at: string;
}

function mapItem(d: RawBucketItem): BucketItem {
  return {
    id: d.id,
    category: d.category as BucketCategory,
    label: d.label,
    content: d.content,
    createdAt: d.created_at,
  };
}

export function useBucket() {
  const [items, setItems] = useState<BucketItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/bucket")
      .then((r) => r.json())
      .then((data: RawBucketItem[]) => setItems(data.map(mapItem)))
      .finally(() => setLoading(false));
  }, []);

  const addItem = useCallback(async (category: BucketCategory, label: string, content?: string) => {
    const res = await fetch("/api/bucket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, label, content: content ?? null }),
    });
    const data = await res.json();
    if (data.id) {
      setItems((prev) => [...prev, mapItem(data)]);
    }
    return data;
  }, []);

  const addItems = useCallback(async (newItems: { category: BucketCategory; label: string; content?: string }[]) => {
    const results = await Promise.all(
      newItems.map((item) =>
        fetch("/api/bucket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: item.category, label: item.label, content: item.content ?? null }),
        }).then((r) => r.json()),
      ),
    );
    const created = results.filter((d) => d.id).map(mapItem);
    setItems((prev) => [...prev, ...created]);
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

  return { items, grouped, loading, addItem, addItems, updateItem, deleteItem };
}
