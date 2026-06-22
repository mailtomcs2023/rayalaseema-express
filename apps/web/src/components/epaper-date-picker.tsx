"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const EDITION_NAMES: Record<string, string> = {
  kurnool: "కర్నూలు",
  nandyal: "నంద్యాల",
  ananthapuramu: "అనంతపురం",
  "sri-sathya-sai": "శ్రీ సత్యసాయి",
  kadapa: "కడప",
  annamayya: "అన్నమయ్య",
  tirupati: "తిరుపతి",
  chittoor: "చిత్తూరు",
};

const MONTHS = [
  "జనవరి","ఫిబ్రవరి","మార్చి","ఏప్రిల్","మే","జూన్",
  "జులై","ఆగస్టు","సెప్టెంబర్","అక్టోబర్","నవంబర్","డిసెంబర్",
];
const DAYS = [
  "ఆదివారం","సోమవారం","మంగళవారం","బుధవారం","గురువారం","శుక్రవారం","శనివారం",
];

/** YYYY-MM-DD from a local Date (avoids UTC offset issues) */
function toIso(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Telugu formatted date label from a local Date */
function teluguDateLocal(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${DAYS[d.getDay()]}`;
}

/** Parse "YYYY-MM-DD" as a LOCAL Date (no UTC shift) */
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

interface Props {
  /** All dates that have at least one published edition (YYYY-MM-DD, newest first) */
  availableDates: string[];
  /** Currently selected date (YYYY-MM-DD) */
  selectedDate: string;
  /** Currently active edition key */
  editionKey: string;
  /** Edition keys available for the selected date (already excluding "main") */
  districtEditions: string[];
  /** True when served on the epaper.* subdomain (affects href prefix) */
  onSub: boolean;
  /**
   * When true, renders the trigger as plain white bold text (matching the
   * viewer toolbar ev-date style) instead of an outline button. Edition
   * pills are hidden in this mode (editions live elsewhere in the toolbar).
   */
  toolbarMode?: boolean;
}

export function EpaperDatePicker({
  availableDates,
  selectedDate,
  editionKey,
  districtEditions,
  onSub,
  toolbarMode = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const availableSet = useMemo(() => new Set(availableDates), [availableDates]);
  const today = useMemo(() => new Date(), []);

  const selectedDateObj = useMemo(
    () => parseLocalDate(selectedDate),
    [selectedDate],
  );

  function epHref(path: string, qs?: string) {
    const p = onSub ? path.replace(/^\/epaper/, "") || "/" : path;
    return qs ? `${p}?${qs}` : p;
  }

  function onDateSelect(d?: Date) {
    if (!d) return;
    const ds = toIso(d);
    setOpen(false);
    router.push(epHref("/epaper", `date=${ds}&edition=${editionKey}`));
  }

  if (toolbarMode) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {/* Plain text trigger styled to match .ev-date */}
          <button
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              fontFamily: "var(--font-telugu-heading), serif",
              fontSize: 15, fontWeight: 800, color: "#fff",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <CalendarIcon style={{ width: 14, height: 14, opacity: 0.8, flexShrink: 0 }} />
            {teluguDateLocal(selectedDateObj)}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" sideOffset={6}>
          <Calendar
            mode="single"
            selected={selectedDateObj}
            defaultMonth={selectedDateObj}
            onSelect={onDateSelect}
            disabled={{ after: today }}
            endMonth={today}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="flex flex-col gap-3 pt-4 pb-2">
      {/* ── Date picker button ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="gap-2 font-semibold"
              style={{ fontFamily: "var(--font-telugu-body), sans-serif", fontSize: 14 }}
            >
              <CalendarIcon className="size-4 shrink-0" />
              {teluguDateLocal(selectedDateObj)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" sideOffset={6}>
            <Calendar
              mode="single"
              selected={selectedDateObj}
              defaultMonth={selectedDateObj}
              onSelect={onDateSelect}
              disabled={{ after: today }}
              endMonth={today}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* ── District edition buttons (hidden when only "main" is available) ── */}
      {districtEditions.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {districtEditions.map((ek) => (
            <Button
              key={ek}
              size="sm"
              variant={ek === editionKey ? "default" : "outline"}
              style={{ fontFamily: "var(--font-telugu-body), sans-serif", fontSize: 13, fontWeight: 700 }}
              onClick={() =>
                router.push(epHref("/epaper", `date=${selectedDate}&edition=${ek}`))
              }
            >
              {EDITION_NAMES[ek] ?? ek}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
