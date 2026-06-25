"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdEditor, type AdRow } from "@/components/ads-manager";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { confirm } from "@/components/confirm-dialog";

// Standalone "Edit Ad" page (reuses the AdEditor form from the ads list).
// Leaving with unsaved changes (Back or Cancel) prompts a confirm dialog.
export function EditAdClient({
  ad,
  positions,
  existingByPosition,
  tileAds,
}: {
  ad: AdRow;
  positions: string[];
  existingByPosition: Record<string, string>;
  tileAds?: { id: string; url: string; link: string | null }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  async function leave() {
    if (dirty) {
      const ok = await confirm({
        title: "Discard changes?",
        description: "You have unsaved changes. If you leave this page, they will be lost.",
        confirmText: "Discard changes",
        cancelText: "Keep editing",
        destructive: true,
      });
      if (!ok) return;
    }
    router.push("/ads");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={leave}>
          <ArrowLeft /> Back
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Edit Ad</h1>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4 border-destructive/40">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <AdEditor
        ad={ad}
        initialPositions={positions}
        existingByPosition={existingByPosition}
        tileAds={tileAds}
        onCancel={leave}
        onSaved={() => {
          router.push("/ads");
          router.refresh();
        }}
        onError={setError}
        onDirtyChange={setDirty}
      />
    </div>
  );
}
