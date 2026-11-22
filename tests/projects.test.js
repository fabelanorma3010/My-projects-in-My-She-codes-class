const test = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../api/projects");

function createResponse() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("syncs paginated projects using verified production domains only", async (t) => {
  const originalFetch = global.fetch;
  const originalToken = process.env.VERCEL_ACCESS_TOKEN;
  const originalTeam = process.env.VERCEL_TEAM_ID;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.VERCEL_ACCESS_TOKEN;
    else process.env.VERCEL_ACCESS_TOKEN = originalToken;
    if (originalTeam === undefined) delete process.env.VERCEL_TEAM_ID;
    else process.env.VERCEL_TEAM_ID = originalTeam;
  });
  process.env.VERCEL_ACCESS_TOKEN = "test-token";
  process.env.VERCEL_TEAM_ID = "team-test";
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push(url);
    assert.equal(options.headers.Authorization, "Bearer test-token");
    assert.equal(url.searchParams.get("teamId"), "team-test");
    if (url.pathname === "/v10/projects") {
      if (url.searchParams.get("from") === "next-page") {
        return { ok: true, json: async () => ({ projects: [
          { id: "p2", name: "protected", passwordProtection: {} },
          { id: "p3", name: "other-site" },
        ], pagination: { next: null } }) };
      }
      return { ok: true, json: async () => ({ projects: [
        { id: "p1", name: "welcome-to-chicago" },
      ], pagination: { next: "next-page" } }) };
    }
    assert.equal(url.searchParams.get("production"), "true");
    assert.equal(url.searchParams.get("verified"), "true");
    assert.equal(url.searchParams.get("redirects"), "false");
    const domains = url.pathname.includes("/p1/")
      ? [
          { name: "preview.example.com", verified: true, gitBranch: "feature" },
          { name: "welcome-to-chicago.vercel.app", verified: true },
        ]
      : [{ name: "not-verified.vercel.app", verified: false }];
    return { ok: true, json: async () => ({ domains }) };
  };

  const response = createResponse();
  await handler({ method: "GET" }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    projects: [{ name: "welcome-to-chicago", url: "https://welcome-to-chicago.vercel.app/" }],
  });
  assert.equal(calls.length, 4);
});

test("reports missing configuration without contacting Vercel", async (t) => {
  const originalToken = process.env.VERCEL_ACCESS_TOKEN;
  t.after(() => {
    if (originalToken === undefined) delete process.env.VERCEL_ACCESS_TOKEN;
    else process.env.VERCEL_ACCESS_TOKEN = originalToken;
  });
  delete process.env.VERCEL_ACCESS_TOKEN;
  const response = createResponse();
  await handler({ method: "GET" }, response);
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: "Vercel project sync is not configured" });
});

test("reports upstream failures instead of returning an empty project list", async (t) => {
  const originalFetch = global.fetch;
  const originalToken = process.env.VERCEL_ACCESS_TOKEN;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.VERCEL_ACCESS_TOKEN;
    else process.env.VERCEL_ACCESS_TOKEN = originalToken;
  });
  process.env.VERCEL_ACCESS_TOKEN = "test-token";
  global.fetch = async () => ({ ok: false, status: 401 });
  const response = createResponse();
  await handler({ method: "GET" }, response);
  assert.equal(response.statusCode, 502);
  assert.deepEqual(response.body, { error: "Could not load Vercel projects" });
});
