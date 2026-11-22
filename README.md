# Portfolio

The homepage shows the featured Chicago website and can automatically list
websites from Vercel. The automatic list uses the server-side function in
`api/projects.js`; it does not put the Vercel access token in the browser.

## Set up automatic Vercel sync

1. Deploy this repository as a Vercel project.
2. Create a Vercel access token with the narrowest scope covering the projects
   you want to show. In the portfolio project's Vercel settings, add it as the
   sensitive environment variable `VERCEL_ACCESS_TOKEN`. Never commit or share
   the token.
3. If the websites belong to a team, also set `VERCEL_TEAM_ID` to that team's ID.
   The sync lists one account or team at a time, according to the token and team
   settings.
4. Redeploy after changing environment variables.

The public homepage exposes names and verified production domains for the
projects in that scope. Paused and password- or SSO-protected projects are
excluded. Review the token scope before enabling sync; do not include projects
whose names or domains should remain private. A project without a verified
production domain is not shown.

The Chicago card is always shown independently of the sync. To test the API
locally, use Vercel's local development server with the environment variables
configured. A plain static server can show the Chicago card but cannot run the
API; the page will report that automatic sync is unavailable.
