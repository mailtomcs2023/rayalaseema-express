#!/usr/bin/env node
/**
 * MCP server for Google PageSpeed Insights.
 *
 * Exists because measuring performance from a developer laptop is not
 * trustworthy: two identical local Lighthouse runs against this site produced
 * TBT of 1,360 ms and 2,040 ms, and a third reported 3,300 ms purely because a
 * deploy was running at the same time. PSI runs on Google's own hardware, so
 * the numbers are comparable run to run and match what anyone else sees when
 * they audit the site.
 *
 * Auth: an API key. Anonymous PSI calls are throttled to the point of being
 * unusable (HTTP 429 within a couple of requests). The key is read from the
 * environment or from a key file - never hard-coded, and never accepted as a
 * tool argument, so it cannot end up in a transcript or a permission
 * allow-list.
 *
 * Env:
 *   PSI_API_KEY        the key itself, or
 *   PSI_API_KEY_FILE   path to a file containing it (first non-empty line)
 */

import { readFileSync } from "node:fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];
const CORE_METRICS = [
  ["first-contentful-paint", "FCP"],
  ["largest-contentful-paint", "LCP"],
  ["total-blocking-time", "TBT"],
  ["cumulative-layout-shift", "CLS"],
  ["speed-index", "SI"],
  ["interactive", "TTI"],
];

function apiKey() {
  if (process.env.PSI_API_KEY?.trim()) return process.env.PSI_API_KEY.trim();
  const file = process.env.PSI_API_KEY_FILE;
  if (file) {
    const line = readFileSync(file, "utf8").split("\n").find((l) => l.trim());
    if (line) return line.trim();
  }
  throw new Error(
    "No PSI API key. Set PSI_API_KEY or PSI_API_KEY_FILE in the server's env block.",
  );
}

/**
 * Call PSI. Retries 429/5xx with exponential backoff - a PSI run takes 20-60s
 * server-side and transient failures are normal.
 */
async function runPsi({ url, strategy = "mobile", categories = CATEGORIES }) {
  const params = new URLSearchParams({ url, strategy, key: apiKey() });
  for (const c of categories) params.append("category", c);

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 5000 * 2 ** attempt));
    try {
      const res = await fetch(`${API}?${params}`, { signal: AbortSignal.timeout(180_000) });
      if (res.ok) return res.json();
      lastError = new Error(`PSI HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      // 4xx other than rate-limiting will not fix themselves.
      if (res.status !== 429 && res.status < 500) throw lastError;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

/** Scores + Core Web Vitals + the audits that are actually costing points. */
function summarise(data, { maxAudits = 15 } = {}) {
  const lh = data.lighthouseResult;
  const audits = lh.audits;

  const scores = {};
  for (const c of CATEGORIES) {
    const cat = lh.categories[c];
    if (cat?.score != null) scores[c] = Math.round(cat.score * 100);
  }

  const metrics = {};
  for (const [id, short] of CORE_METRICS) {
    if (audits[id]?.displayValue) {
      metrics[short] = {
        value: audits[id].displayValue,
        score: audits[id].score == null ? null : Math.round(audits[id].score * 100),
      };
    }
  }

  // Which category does each audit belong to? Lets the caller see at a glance
  // whether a failure costs Performance or Accessibility.
  const catOf = {};
  for (const c of CATEGORIES) {
    for (const ref of lh.categories[c]?.auditRefs ?? []) {
      (catOf[ref.id] ??= []).push(c);
    }
  }

  const failing = [];
  for (const [id, audit] of Object.entries(audits)) {
    if (audit.score == null || audit.score >= 0.9) continue;
    const det = audit.details ?? {};
    failing.push({
      id,
      title: audit.title,
      score: audit.score,
      categories: catOf[id] ?? [],
      savingsMs: Math.round(det.overallSavingsMs ?? 0) || undefined,
      savingsKb: det.overallSavingsBytes
        ? Math.round(det.overallSavingsBytes / 1024)
        : undefined,
      displayValue: audit.displayValue,
    });
  }
  // Biggest wins first: time saved, then bytes.
  failing.sort((a, b) => (b.savingsMs ?? 0) - (a.savingsMs ?? 0) || (b.savingsKb ?? 0) - (a.savingsKb ?? 0));

  const lcpEl = audits["largest-contentful-paint-element"]?.details?.items?.[0];
  const lcpNode = lcpEl?.items?.[0]?.node ?? lcpEl?.node;

  return {
    url: lh.finalDisplayedUrl ?? lh.finalUrl,
    strategy: lh.configSettings?.formFactor,
    fetchedAt: lh.fetchTime,
    lighthouseVersion: lh.lighthouseVersion,
    scores,
    metrics,
    lcpElement: lcpNode?.snippet?.slice(0, 220),
    // Real-user data, when Google has enough traffic for this origin.
    fieldData: data.loadingExperience?.metrics
      ? Object.fromEntries(
          Object.entries(data.loadingExperience.metrics).map(([k, v]) => [k, v.category]),
        )
      : "no field data (not enough real-user traffic yet)",
    failingAudits: failing.slice(0, maxAudits),
    failingAuditCount: failing.length,
  };
}

const TOOLS = [
  {
    name: "psi_run",
    description:
      "Run PageSpeed Insights on a URL and return the four category scores, Core Web Vitals, the LCP element, and the failing audits ranked by how much they cost. Use this instead of a local Lighthouse run - local numbers vary by 50%+ depending on what else the machine is doing.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL to audit, including https://" },
        strategy: {
          type: "string",
          enum: ["mobile", "desktop"],
          default: "mobile",
          description: "mobile is throttled 4G + slow CPU, and is what ~90% of readers get",
        },
        maxAudits: { type: "number", default: 15, description: "How many failing audits to list" },
      },
      required: ["url"],
    },
  },
  {
    name: "psi_run_both",
    description:
      "Run PSI on one URL for BOTH mobile and desktop and return the two summaries side by side. Runs sequentially - PSI takes 20-60s per run.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        maxAudits: { type: "number", default: 10 },
      },
      required: ["url"],
    },
  },
  {
    name: "psi_audit_detail",
    description:
      "Return the full item table for ONE audit (e.g. third-party-summary, bootup-time, uses-responsive-images, target-size). This is how you find WHICH script or image is responsible, rather than guessing from the headline number.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        auditId: {
          type: "string",
          description: "Lighthouse audit id, e.g. 'third-party-summary' or 'mainthread-work-breakdown'",
        },
        strategy: { type: "string", enum: ["mobile", "desktop"], default: "mobile" },
        limit: { type: "number", default: 20 },
      },
      required: ["url", "auditId"],
    },
  },
  {
    name: "psi_compare",
    description:
      "Run PSI on several URLs with the same strategy and return a compact score table. Use to check that a fix on one page type did not regress another.",
    inputSchema: {
      type: "object",
      properties: {
        urls: { type: "array", items: { type: "string" }, maxItems: 6 },
        strategy: { type: "string", enum: ["mobile", "desktop"], default: "mobile" },
      },
      required: ["urls"],
    },
  },
];

const server = new Server(
  { name: "mcp-psi", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  const json = (v) => ({ content: [{ type: "text", text: JSON.stringify(v, null, 2) }] });

  try {
    if (name === "psi_run") {
      const data = await runPsi({ url: args.url, strategy: args.strategy ?? "mobile" });
      return json(summarise(data, { maxAudits: args.maxAudits ?? 15 }));
    }

    if (name === "psi_run_both") {
      const out = {};
      for (const strategy of ["mobile", "desktop"]) {
        const data = await runPsi({ url: args.url, strategy });
        out[strategy] = summarise(data, { maxAudits: args.maxAudits ?? 10 });
      }
      return json(out);
    }

    if (name === "psi_audit_detail") {
      const data = await runPsi({ url: args.url, strategy: args.strategy ?? "mobile" });
      const audit = data.lighthouseResult.audits[args.auditId];
      if (!audit) {
        return json({
          error: `No audit '${args.auditId}' in this report.`,
          available: Object.keys(data.lighthouseResult.audits).sort().slice(0, 80),
        });
      }
      return json({
        id: args.auditId,
        title: audit.title,
        score: audit.score,
        displayValue: audit.displayValue,
        description: audit.description,
        items: (audit.details?.items ?? []).slice(0, args.limit ?? 20),
      });
    }

    if (name === "psi_compare") {
      const rows = [];
      for (const url of args.urls.slice(0, 6)) {
        try {
          const data = await runPsi({ url, strategy: args.strategy ?? "mobile" });
          const s = summarise(data, { maxAudits: 0 });
          rows.push({ url, scores: s.scores, metrics: s.metrics });
        } catch (e) {
          rows.push({ url, error: String(e.message ?? e) });
        }
      }
      return json({ strategy: args.strategy ?? "mobile", results: rows });
    }

    return json({ error: `Unknown tool: ${name}` });
  } catch (e) {
    return {
      isError: true,
      content: [{ type: "text", text: `PSI request failed: ${e.message ?? e}` }],
    };
  }
});

await server.connect(new StdioServerTransport());
