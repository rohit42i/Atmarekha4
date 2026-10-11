import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchAdminAnalytics,
  fetchAnalyticsViews,
  requestAnalytics,
} from "./analyticsClient.js";

async function withFetch(stub, run) {
  const previous = globalThis.fetch;
  globalThis.fetch = stub;
  try {
    return await run();
  } finally {
    globalThis.fetch = previous;
  }
}

test("rejects unversioned or absolute paths before making a request", async () => {
  await assert.rejects(
    requestAnalytics("https://unexpected.example/steal"),
    /versioned \/v1\//,
  );
  await assert.rejects(requestAnalytics("//unexpected.example/v1/view"), /versioned/);
});

test("returns an empty object for an empty public view query", async () => {
  await withFetch(
    async () => {
      throw new Error("fetch should not be called for an empty identifier list");
    },
    async () => {
      assert.deepEqual(await fetchAnalyticsViews([]), {});
    },
  );
});

test("deduplicates and bounds identifiers before calling the versioned endpoint", async () => {
  await withFetch(
    async (input) => {
      assert.match(String(input), /\/v1\/views\?chapterIds=/);
      assert.ok(String(input).includes("chapter-a%2Cchapter-b"));
      return new Response(JSON.stringify({ "chapter-a": 5, "chapter-b": 8 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
    async () => {
      const result = await fetchAnalyticsViews(["chapter-a", "chapter-a", "chapter-b"]);
      assert.deepEqual(result, { "chapter-a": 5, "chapter-b": 8 });
    },
  );
});

test("refuses admin analytics without valid period and token", async () => {
  await assert.rejects(fetchAdminAnalytics(14, "token"), /1, 7, 30 or 90/);
  await assert.rejects(fetchAdminAnalytics(30, ""), /Admin session required/);
});

test("maps infrastructure errors to a safe fallback message", async () => {
  await withFetch(
    async () =>
      new Response(
        JSON.stringify({
          error: "permission denied at https://internal.example with SQLSTATE 42501",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      ),
    async () => {
      await assert.rejects(
        requestAnalytics("/v1/view"),
        /Analytics service is temporarily unavailable/,
      );
    },
  );
});

test("maps network failures to a friendly connection message", async () => {
  await withFetch(
    async () => {
      throw new TypeError("Failed to fetch");
    },
    async () => {
      await assert.rejects(
        requestAnalytics("/v1/view"),
        /Connection problem. Check your internet and try again./,
      );
    },
  );
});
