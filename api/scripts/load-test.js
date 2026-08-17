#!/usr/bin/env node
// Load-testing baseline (autocannon — pure Node, no system binary to
// install, unlike k6). Deliberately a *local dev sanity check*, not a
// production capacity plan: this environment's single-instance, in-memory
// rate limiting (see DEPLOYMENT.md's "Known limitations") and whatever
// machine happens to run it aren't representative of real production
// infrastructure. Its actual job is catching a gross regression (a query
// that got 10x slower, an endpoint that started erroring under light
// concurrency) — run it again once there's a real deployed target and a
// traffic estimate, per DEPLOYMENT.md.
//
// Usage:
//   npm run load-test                       # against http://localhost:3001/api/v1
//   BASE_URL=https://api.example.com/api/v1 npm run load-test

const autocannon = require("autocannon");

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3001/api/v1";
const DURATION_SECONDS = Number(process.env.LOAD_TEST_DURATION ?? 10);
const CONNECTIONS = Number(process.env.LOAD_TEST_CONNECTIONS ?? 10);

function run(opts) {
  return new Promise((resolve, reject) => {
    autocannon(
      {
        connections: CONNECTIONS,
        duration: DURATION_SECONDS,
        ...opts,
      },
      (err, result) => (err ? reject(err) : resolve(result)),
    );
  });
}

function summarize(name, result) {
  const { requests, latency, errors, statusCodeStats } = result;
  // 429s are the rate limiter (@nestjs/throttler, 120/min default —
  // see api/README.md's Security section) doing exactly what it's for
  // under sustained concurrent load, not a bug — only count genuine
  // server failures (5xx) and connection-level errors as a real problem.
  const rateLimited = statusCodeStats?.["429"]?.count ?? 0;
  const serverErrors = Object.entries(statusCodeStats ?? {})
    .filter(([code]) => Number(code) >= 500)
    .reduce((sum, [, stats]) => sum + stats.count, 0);
  const ok = errors === 0 && serverErrors === 0;
  console.log(
    [
      `${name.padEnd(28)}`,
      `${String(requests.average.toFixed(0)).padStart(6)} req/s avg`,
      `p50 ${String(latency.p50).padStart(4)}ms`,
      `p99 ${String(latency.p99).padStart(5)}ms`,
      `connErrors=${errors} serverErrors=${serverErrors} rateLimited(429)=${rateLimited}`,
      ok ? "OK" : "PROBLEM",
    ].join("  "),
  );
  return ok;
}

async function main() {
  console.log(`Load test against ${BASE_URL}`);
  console.log(`${CONNECTIONS} connections, ${DURATION_SECONDS}s per scenario\n`);

  // Need a real slug for the detail-page scenario — grab one from the
  // list endpoint rather than hardcoding seed data that might not exist.
  const listRes = await fetch(`${BASE_URL}/places?limit=1`);
  const listBody = await listRes.json();
  const slug = listBody?.data?.[0]?.slug;
  if (!slug) {
    console.error(
      "No places found — run `npm run seed` against the DB this is pointed at first.",
    );
    process.exit(1);
  }

  const scenarios = [
    { name: "GET /health", opts: { url: `${BASE_URL.replace(/\/api\/v1\/?$/, "")}/health` } },
    { name: "GET /places (browse)", opts: { url: `${BASE_URL}/places?limit=20` } },
    { name: "GET /places (full-text search)", opts: { url: `${BASE_URL}/places?q=beach` } },
    { name: "GET /places/:slug (detail)", opts: { url: `${BASE_URL}/places/${slug}` } },
  ];

  let allOk = true;
  for (const { name, opts } of scenarios) {
    const result = await run(opts);
    allOk = summarize(name, result) && allOk;
  }

  console.log(
    "\nA local single-instance run, not a production capacity number — see this file's header comment.",
  );
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
