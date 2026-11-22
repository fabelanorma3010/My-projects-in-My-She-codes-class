const VERCEL_API = "https://api.vercel.com";

async function getVercelJson(path, parameters, token) {
  const url = new URL(path, VERCEL_API);
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`Vercel API returned ${response.status}`);
  }
  return response.json();
}

async function listProjects(token, teamId) {
  const projects = [];
  const cursors = new Set();
  let cursor;

  do {
    const parameters = { limit: 100, teamId };
    if (typeof cursor === "number") {
      parameters.until = cursor;
    } else if (cursor != null) {
      parameters.from = cursor;
    }
    const data = await getVercelJson("/v10/projects", parameters, token);
    const page = Array.isArray(data) ? data : data.projects;
    if (!Array.isArray(page)) {
      throw new Error("Vercel API returned an invalid project list");
    }
    projects.push(...page);
    cursor = Array.isArray(data) ? null : data.pagination?.next;
    if (cursor != null) {
      const key = String(cursor);
      if (cursors.has(key)) {
        throw new Error("Vercel API returned a repeated pagination cursor");
      }
      cursors.add(key);
    }
  } while (cursor != null);

  return projects;
}

async function projectWebsite(project, token, teamId) {
  if (
    typeof project.id !== "string" ||
    typeof project.name !== "string" ||
    project.paused ||
    project.passwordProtection ||
    (project.ssoProtection && project.ssoProtection.deploymentType !== "preview")
  ) {
    return null;
  }

  const data = await getVercelJson(
    `/v9/projects/${encodeURIComponent(project.id)}/domains`,
    { production: "true", verified: "true", redirects: "false", limit: 100, teamId },
    token
  );
  if (!Array.isArray(data.domains)) {
    throw new Error("Vercel API returned an invalid domain list");
  }
  const domain = data.domains.find(
    (item) =>
      item.verified === true &&
      !item.gitBranch &&
      !item.redirect &&
      typeof item.name === "string" &&
      /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(item.name)
  );
  return domain ? { name: project.name, url: `https://${domain.name}/` } : null;
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const token = process.env.VERCEL_ACCESS_TOKEN;
  if (!token) {
    console.error("VERCEL_ACCESS_TOKEN is not configured");
    return response.status(503).json({ error: "Vercel project sync is not configured" });
  }

  try {
    const teamId = process.env.VERCEL_TEAM_ID;
    const projects = await listProjects(token, teamId);
    const websites = await Promise.all(
      projects.map((project) => projectWebsite(project, token, teamId))
    );
    response.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return response.status(200).json({ projects: websites.filter(Boolean) });
  } catch (error) {
    console.error("Vercel project sync failed:", error.message);
    return response.status(502).json({ error: "Could not load Vercel projects" });
  }
};
