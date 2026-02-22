"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock,
  Download,
  Loader2,
  Package,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

interface SharedPackage {
  shareCode: string;
  creatorName: string;
  environmentName: string;
  description: string | null;
  createdAt: string;
  itemCount: number;
  configCount: number;
}

export default function SharedPage() {
  const [packages, setPackages] = useState<SharedPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [imported, setImported] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/share/browse")
      .then((r) => r.json())
      .then((data) => {
        setPackages(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleImport = async (code: string) => {
    setImporting(code);
    const res = await fetch("/api/share/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareCode: code }),
    });
    const data = await res.json();
    if (data.environmentId) {
      setImported(code);
      setTimeout(() => setImported(null), 2000);
    }
    setImporting(null);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="flex items-center gap-3 px-6 py-2.5">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Canvas
          </Link>
          <div className="h-4 w-px bg-border" />
          <Link
            href="/registry"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Registry
          </Link>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-sm font-semibold">Shared Packages</h1>
          <Badge variant="secondary" className="text-[10px]">
            {packages.length} packages
          </Badge>
          <div className="flex-1" />
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : packages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <Package className="h-6 w-6 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No shared packages yet.</p>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-2">
            {packages.map((pkg) => (
              <div
                key={pkg.shareCode}
                className="rounded-lg border border-border bg-card p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">{pkg.environmentName}</h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {pkg.itemCount} items · {pkg.configCount} configs
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <User className="h-3 w-3" />
                  {pkg.creatorName}
                  <span>·</span>
                  <Clock className="h-3 w-3" />
                  {new Date(pkg.createdAt).toLocaleDateString()}
                </div>
                {pkg.description && (
                  <p className="text-xs text-muted-foreground">{pkg.description}</p>
                )}
                <div className="flex items-center gap-2">
                  <code className="text-[10px] font-mono text-muted-foreground/60">
                    {pkg.shareCode}
                  </code>
                  <div className="flex-1" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleImport(pkg.shareCode)}
                    disabled={importing === pkg.shareCode || imported === pkg.shareCode}
                  >
                    {importing === pkg.shareCode ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : imported === pkg.shareCode ? (
                      <Check className="h-3 w-3 mr-1" />
                    ) : (
                      <Download className="h-3 w-3 mr-1" />
                    )}
                    {imported === pkg.shareCode ? "Imported" : "Import"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
