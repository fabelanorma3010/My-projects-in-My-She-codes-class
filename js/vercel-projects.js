const projectList = document.getElementById("vercel-project-list");
const projectStatus = document.getElementById("vercel-project-status");

async function loadVercelProjects() {
  try {
    const response = await fetch("/api/projects");
    if (!response.ok) {
      throw new Error(`Project API returned ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data.projects)) {
      throw new Error("Project API returned an invalid response");
    }

    const existingUrls = new Set(
      Array.from(document.querySelectorAll("[data-project-url]"), (card) =>
        new URL(card.dataset.projectUrl).hostname.toLowerCase()
      )
    );
    let added = 0;

    for (const project of data.projects) {
      if (typeof project.name !== "string" || typeof project.url !== "string") {
        throw new Error("Project API returned an invalid project");
      }

      const url = new URL(project.url);
      if (url.protocol !== "https:" || url.username || url.password) {
        throw new Error("Project API returned an invalid website URL");
      }
      if (existingUrls.has(url.hostname.toLowerCase())) {
        continue;
      }
      existingUrls.add(url.hostname.toLowerCase());

      const card = document.createElement("article");
      card.className = "vercel-project-card";
      const title = document.createElement("h3");
      title.textContent = project.name.replace(/[-_]+/g, " ");
      const link = document.createElement("a");
      link.href = url.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Visit website \u2192";
      card.append(title, link);
      projectList.append(card);
      added += 1;
    }

    projectStatus.textContent = added
      ? "Websites synced from Vercel."
      : "No additional websites found in Vercel.";
  } catch (error) {
    console.error("Could not load Vercel projects:", error);
    projectStatus.textContent =
      "Automatic Vercel sync is unavailable. The featured website above is still available.";
  }
}

loadVercelProjects();
