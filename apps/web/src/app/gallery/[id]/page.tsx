"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { prisma } from "@rayalaseema/db";

// Gallery page reads from DB - no hardcoded data
// For now redirect to homepage since gallery CRUD is in admin
export default function GalleryPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Gallery</h1>
        <p style={{ color: "#888", marginTop: 8 }}>Coming soon - manage galleries from admin panel</p>
        <Link href="/" style={{ display: "inline-block", marginTop: 20, padding: "10px 24px", background: "var(--color-brand)", color: "#fff", borderRadius: 8, fontWeight: 700, textDecoration: "none" }}>
          Back to Home
        </Link>
      </div>
    </div>
  );
}
