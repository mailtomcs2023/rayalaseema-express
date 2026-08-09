#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";

import { createClient } from "./auth.js";
import { InspectionCache } from "./cache.js";
import { loadConfig } from "./config.js";
import { Inspector, InspectionOutcome, summarise } from "./inspector.js";
import { QuotaTracker } from "./quota.js";
import { fetchSitemapUrls } from "./sitemap.js";

const config = loadConfig();
const client = createClient(config);
const cache = new InspectionCache(config);
const quota = new QuotaTracker(config);
const inspector = new Inspector(client, config, cache, quota);

const server = new McpServer({ name: "gsc", version: "1.0.0" });

/**
 * Every response carries the live quota snapshot. The 2,000/day inspection
 * budget is the binding constraint on this whole server, so the caller should
 * never have to run a separate tool to find out how much is left.
 */
function ok(payload: unknown) {
  const body = { ...(payload as Record<string, unknown>), quota: quota.snapshot() };
  return { content: [{ type: "text" as const, text: JSON.stringify(body, null, 2) }] };
}

function fail(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ error: message, quota: quota.snapshot() }, null, 2) }],
  };
}

function apiMessage(err: unknown): string {
  const e = err as { errors?: { message?: string }[]; message?: string; response?: { status?: number } };
  const status = e?.response?.status;
  const msg = e?.errors?.[0]?.message ?? e?.message ?? String(err);
  return status ? `${status}: ${msg}` : msg;
}

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

// ---------------------------------------------------------------- 1. inspect

server.registerTool(
  "gsc_inspect_url",
  {
    title: "Inspect one URL",
    description:
      "Index status for a single URL: verdict, coverageState, indexingState, lastCrawlTime, Google's chosen canonical, fetch and robots state. Served from local cache when fresh; a live call costs 1 of the 2,000 daily inspections.",
    inputSchema: {
      url: z.string().describe("Absolute URL inside the property, e.g. https://rayalaseemanews.com/article-slug"),
      force: z.boolean().optional().describe("Bypass the cache and spend quota on a fresh call. Default false."),
      maxAgeHours: z.number().optional().describe("Treat cached results older than this as stale. Default 24."),
    },
  },
  async ({ url, force, maxAgeHours }) => {
    const result = await inspector.inspect(url, { force, ttlHours: maxAgeHours });
    return result.source === "error" ? fail(result.error ?? "Inspection failed") : ok({ result });
  },
);

// ----------------------------------------------------------- 2. inspect bulk

server.registerTool(
  "gsc_inspect_bulk",
  {
    title: "Inspect many URLs",
    description:
      "Inspects up to 2,000 URLs with a bounded worker pool, cache reuse, per-minute throttling and exponential backoff on 429/5xx. Returns per-URL results plus a bucketed summary. Stops spending when the daily quota runs out and reports what it skipped.",
    inputSchema: {
      urls: z.array(z.string()).min(1).max(2000).describe("Absolute URLs inside the property. Cap 2000."),
      concurrency: z.number().int().min(1).max(20).optional().describe("Parallel in-flight calls. Default 5."),
      force: z.boolean().optional().describe("Bypass the cache for every URL. Default false."),
      maxAgeHours: z.number().optional().describe("Cache freshness window in hours. Default 24."),
      includeResults: z
        .boolean()
        .optional()
        .describe("Include the full per-URL array. Default true; set false for a summary-only response on large runs."),
    },
  },
  async ({ urls, concurrency, force, maxAgeHours, includeResults }) => {
    const { results, skippedForQuota } = await inspector.inspectBulk(urls, {
      concurrency,
      force,
      ttlHours: maxAgeHours,
    });
    return ok({
      summary: summarise(results),
      skippedForQuota: skippedForQuota.length,
      skippedSample: skippedForQuota.slice(0, 20),
      results: includeResults === false ? undefined : results,
    });
  },
);

// ------------------------------------------------------- 3. search analytics

server.registerTool(
  "gsc_search_analytics",
  {
    title: "Search analytics query",
    description:
      "Clicks, impressions, CTR and position by query/page/country/device/date/searchAppearance. Set type to 'discover' or 'news' to see Discover and Google News surfaces, which are reported separately from web search. This endpoint has no per-day URL quota.",
    inputSchema: {
      startDate: DATE.describe("Inclusive start date, YYYY-MM-DD."),
      endDate: DATE.describe("Inclusive end date, YYYY-MM-DD."),
      dimensions: z
        .array(z.enum(["query", "page", "country", "device", "date", "searchAppearance"]))
        .optional()
        .describe("Group-by dimensions. Default ['query']."),
      type: z
        .enum(["web", "news", "discover", "image", "video"])
        .optional()
        .describe("Search surface. Default 'web'. Discover and news only support a subset of dimensions."),
      rowLimit: z.number().int().min(1).max(25000).optional().describe("Rows to return. Default 1000."),
      startRow: z.number().int().min(0).optional().describe("Offset for paging. Default 0."),
      dimensionFilterGroups: z
        .array(z.any())
        .optional()
        .describe(
          "Raw GSC filter groups, e.g. [{groupType:'and',filters:[{dimension:'page',operator:'contains',expression:'/politics/'}]}].",
        ),
      dataState: z.enum(["final", "all"]).optional().describe("'all' includes fresh, not-yet-finalised data."),
      aggregationType: z.enum(["auto", "byPage", "byProperty"]).optional(),
    },
  },
  async (args) => {
    // Discover and News reject most dimensions; failing here with the API's own
    // message is more useful than pre-filtering and silently changing the query.
    try {
      const res = await client.searchanalytics.query({
        siteUrl: config.siteUrl,
        requestBody: {
          startDate: args.startDate,
          endDate: args.endDate,
          dimensions: args.dimensions ?? ["query"],
          type: args.type ?? "web",
          rowLimit: args.rowLimit ?? 1000,
          startRow: args.startRow ?? 0,
          dimensionFilterGroups: args.dimensionFilterGroups as never,
          dataState: args.dataState,
          aggregationType: args.aggregationType,
        },
      });
      const rows = res.data.rows ?? [];
      const totals = rows.reduce(
        (acc: { clicks: number; impressions: number }, r) => ({
          clicks: acc.clicks + (r.clicks ?? 0),
          impressions: acc.impressions + (r.impressions ?? 0),
        }),
        { clicks: 0, impressions: 0 },
      );
      return ok({
        siteUrl: config.siteUrl,
        type: args.type ?? "web",
        dimensions: args.dimensions ?? ["query"],
        rowCount: rows.length,
        totals: {
          ...totals,
          ctr: totals.impressions ? totals.clicks / totals.impressions : 0,
        },
        rows,
      });
    } catch (err) {
      return fail(apiMessage(err));
    }
  },
);

// ------------------------------------------------------------ 4-6. sitemaps

server.registerTool(
  "gsc_list_sitemaps",
  {
    title: "List sitemaps",
    description: "All sitemaps submitted for the property, with last download time, warnings, errors and per-type counts.",
    inputSchema: {
      sitemapIndex: z.string().optional().describe("Only list children of this sitemap index URL."),
    },
  },
  async ({ sitemapIndex }) => {
    try {
      const res = await client.sitemaps.list({ siteUrl: config.siteUrl, sitemapIndex });
      return ok({ sitemaps: res.data.sitemap ?? [] });
    } catch (err) {
      return fail(apiMessage(err));
    }
  },
);

server.registerTool(
  "gsc_get_sitemap",
  {
    title: "Get one sitemap",
    description: "Full detail for one submitted sitemap: lastSubmitted, lastDownloaded, isPending, errors, warnings and contents by type.",
    inputSchema: {
      feedpath: z.string().describe("Full sitemap URL, e.g. https://rayalaseemanews.com/sitemap.xml"),
    },
  },
  async ({ feedpath }) => {
    try {
      const res = await client.sitemaps.get({ siteUrl: config.siteUrl, feedpath });
      return ok({ sitemap: res.data });
    } catch (err) {
      return fail(apiMessage(err));
    }
  },
);

server.registerTool(
  "gsc_submit_sitemap",
  {
    title: "Submit a sitemap",
    description:
      "Submits (or resubmits) a sitemap. This is the only write operation in this server and is disabled unless GSC_ALLOW_SITEMAP_WRITE=true, because the default OAuth scope is read-only.",
    inputSchema: {
      feedpath: z.string().describe("Full sitemap URL to submit."),
    },
  },
  async ({ feedpath }) => {
    if (!config.allowSitemapWrite) {
      return fail(
        "Sitemap submission is disabled. Set GSC_ALLOW_SITEMAP_WRITE=true in the server env and restart — this also upgrades the OAuth scope from webmasters.readonly to webmasters.",
      );
    }
    try {
      await client.sitemaps.submit({ siteUrl: config.siteUrl, feedpath });
      return ok({ submitted: feedpath, siteUrl: config.siteUrl });
    } catch (err) {
      return fail(apiMessage(err));
    }
  },
);

server.registerTool(
  "gsc_delete_sitemap",
  {
    title: "Remove a sitemap submission",
    description:
      "Removes a sitemap from the property's submitted list. This does not delete the file from the site and does not remove any indexed URL — it only stops Search Console tracking that sitemap. Requires GSC_ALLOW_SITEMAP_WRITE=true.",
    inputSchema: {
      feedpath: z.string().describe("Full sitemap URL to unsubmit, e.g. https://rayalaseemanews.com/sitemap.xml"),
      confirm: z
        .boolean()
        .describe("Must be true. Explicit acknowledgement that this removes a live sitemap submission."),
    },
  },
  async ({ feedpath, confirm }) => {
    if (!config.allowSitemapWrite) {
      return fail(
        "Sitemap deletion is disabled. Set GSC_ALLOW_SITEMAP_WRITE=true in the server env and restart to upgrade the scope to webmasters.",
      );
    }
    // The only destructive call in this server, so it will not fire on a bare
    // tool name — the caller has to say so.
    if (confirm !== true) {
      return fail(`Refusing to remove ${feedpath}: pass confirm=true to proceed.`);
    }
    try {
      await client.sitemaps.delete({ siteUrl: config.siteUrl, feedpath });
      return ok({ removed: feedpath, siteUrl: config.siteUrl });
    } catch (err) {
      return fail(apiMessage(err));
    }
  },
);

// ------------------------------------------- 9. Indexing API (best-effort)

server.registerTool(
  "gsc_request_indexing",
  {
    title: "Request indexing via the Indexing API (best-effort)",
    description:
      "Submits URL_UPDATED notifications to the Google Indexing API. IMPORTANT CAVEAT: Google documents this API as supporting only JobPosting/BroadcastEvent pages; for news articles it is unsupported and may be ignored. It historically triggered crawls anyway (the mechanism behind WordPress 'instant indexing' plugins) and has no documented penalty, so it is exposed here as a best-effort, owner-approved channel. Default quota 200/day, tracked separately from URL Inspection.",
    inputSchema: {
      urls: z.array(z.string()).min(1).max(200).describe("Absolute URLs inside the property. Indexing API default quota is 200/day."),
    },
  },
  async ({ urls }) => {
    // Separate auth: the Indexing API needs its own scope, and the service
    // account must be a verified OWNER (not just Full) on the GSC property.
    const { JWT } = await import("google-auth-library");
    const { readFileSync } = await import("node:fs");
    const key = JSON.parse(readFileSync(config.keyFile, "utf8"));
    const jwt = new JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: ["https://www.googleapis.com/auth/indexing"],
    });

    const results: { url: string; status: number | string; detail?: string }[] = [];
    for (const url of urls) {
      try {
        const res = await jwt.request({
          url: "https://indexing.googleapis.com/v3/urlNotifications:publish",
          method: "POST",
          data: { url, type: "URL_UPDATED" },
        });
        results.push({ url, status: res.status });
      } catch (err) {
        const e = err as { response?: { status?: number; data?: unknown }; message?: string };
        results.push({
          url,
          status: e.response?.status ?? "ERR",
          detail:
            typeof e.response?.data === "object"
              ? JSON.stringify(e.response.data).slice(0, 300)
              : (e.message ?? "").slice(0, 300),
        });
      }
    }
    const accepted = results.filter((r) => r.status === 200).length;
    return ok({
      accepted,
      failed: results.length - accepted,
      note:
        accepted === 0 && results.some((r) => r.status === 403)
          ? "403s usually mean the Indexing API is not enabled on the project, or the service account is not an OWNER in Search Console."
          : undefined,
      results,
    });
  },
);

// ------------------------------------------------- 7. index coverage report

server.registerTool(
  "gsc_index_coverage_report",
  {
    title: "Index coverage report",
    description:
      "The day-to-day tool. Reads URLs from the live sitemap, inspects as many as the remaining daily quota allows, writes CSV + JSON to disk and returns the indexed / crawled-not-indexed / discovered-not-indexed / excluded split.",
    inputSchema: {
      sitemapUrl: z
        .string()
        .optional()
        .describe(
          "Sitemap to read. Default https://<property host>/sitemap-index.xml, whose child sitemaps are followed one level.",
        ),
      limit: z.number().int().min(1).max(2000).optional().describe("Max URLs to inspect this run. Default: whatever quota remains."),
      offset: z.number().int().min(0).optional().describe("Skip this many sitemap URLs first, to walk the site across days. Default 0."),
      urlFilter: z.string().optional().describe("Only include sitemap URLs containing this substring, e.g. '/news/'."),
      concurrency: z.number().int().min(1).max(20).optional().describe("Parallel in-flight calls. Default 5."),
      maxAgeHours: z.number().optional().describe("Cache freshness window in hours. Default 24."),
      force: z.boolean().optional().describe("Re-inspect even cached URLs. Expensive. Default false."),
      outputDir: z.string().optional().describe("Where to write the report files. Default <server>/.cache/reports."),
    },
  },
  async (args) => {
    const host = config.siteHost ?? new URL(config.siteUrl).hostname;
    // The index, not a flat sitemap: the site shards articles by publish month,
    // so the index is the only path that reaches every URL.
    const sitemapUrl = args.sitemapUrl ?? `https://${host}/sitemap-index.xml`;

    let discovered: string[];
    let sitemapsRead: string[];
    try {
      const fetched = await fetchSitemapUrls(sitemapUrl);
      discovered = fetched.urls;
      sitemapsRead = fetched.sitemapsRead;
    } catch (err) {
      return fail(`Could not read sitemap ${sitemapUrl}: ${(err as Error).message}`);
    }

    const filtered = args.urlFilter ? discovered.filter((u) => u.includes(args.urlFilter!)) : discovered;
    const offset = args.offset ?? 0;
    const windowed = filtered.slice(offset);

    // Default the batch size to the remaining budget so a plain call never
    // half-finishes: it inspects exactly what today's quota can pay for.
    const budget = Math.max(0, quota.remaining());
    const limit = Math.min(args.limit ?? budget, windowed.length, 2000);
    const targets = windowed.slice(0, limit);

    if (targets.length === 0) {
      return fail(
        budget === 0
          ? `Daily quota exhausted (resets midnight US/Pacific). Sitemap had ${filtered.length} matching URLs.`
          : `No URLs to inspect. Sitemap ${sitemapUrl} yielded ${discovered.length} URLs, ${filtered.length} after filtering, ${windowed.length} after offset ${offset}.`,
      );
    }

    const { results, skippedForQuota } = await inspector.inspectBulk(targets, {
      concurrency: args.concurrency,
      force: args.force,
      ttlHours: args.maxAgeHours,
    });

    const outputDir = resolve(args.outputDir ?? join(config.cacheDir, "reports"));
    mkdirSync(outputDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const csvPath = join(outputDir, `coverage-${stamp}.csv`);
    const jsonPath = join(outputDir, `coverage-${stamp}.json`);

    writeFileSync(csvPath, toCsv(results), "utf8");
    writeFileSync(jsonPath, JSON.stringify(results, null, 2), "utf8");

    const summary = summarise(results);
    return ok({
      sitemapUrl,
      sitemapsRead,
      sitemapUrlCount: discovered.length,
      afterFilter: filtered.length,
      offset,
      inspected: results.length,
      remainingUninspected: Math.max(0, windowed.length - targets.length),
      skippedForQuota: skippedForQuota.length,
      summary,
      files: { csv: csvPath, json: jsonPath },
      nextOffset: offset + targets.length,
    });
  },
);

const CSV_COLUMNS = [
  "url",
  "bucket",
  "verdict",
  "coverageState",
  "indexingState",
  "lastCrawlTime",
  "googleCanonical",
  "userCanonical",
  "pageFetchState",
  "robotsTxtState",
  "source",
  "fetchedAt",
  "error",
] as const;

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  // Excel treats a leading =, +, - or @ as a formula; prefixing a quote is the
  // standard defence against CSV injection in exported reports.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

function toCsv(rows: InspectionOutcome[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((c) => csvCell((row as unknown as Record<string, unknown>)[c])).join(","));
  }
  return lines.join("\r\n");
}

// --------------------------------------------------------------- bootstrap

process.on("exit", () => cache.flush());
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    cache.flush();
    process.exit(0);
  });
}

const transport = new StdioServerTransport();
await server.connect(transport);
// stdout is the MCP channel; all diagnostics must go to stderr.
console.error(
  `gsc MCP ready · property ${config.siteUrl} · sitemap writes ${config.allowSitemapWrite ? "ENABLED" : "disabled"} · cache ${cache.size()} entries · quota ${quota.remaining()}/${config.dailyQuota} left`,
);
