# PR Viewer — Design Spec

**Date:** 2026-03-26
**Status:** Approved

## Overview

A server-side rendered internal tool for DEFRA forms developers to understand where they can help with code reviews. Built with Hapi.js + Nunjucks + GOV.UK Frontend. Scoped to the `DEFRA/forms` GitHub team. Authenticated via a single shared service PAT (env var `GITHUB_TOKEN`).

---

## Architecture

### Stack

- **Runtime:** Node.js (ES modules, plain JavaScript — no TypeScript)
- **Framework:** `@hapi/hapi` ^21
- **Templating:** `nunjucks` + `@hapi/vision`
- **Static assets:** `@hapi/inert`
- **Design system:** `govuk-frontend` ^5 (macros, components, layout)
- **HTTP client:** native `fetch` (Node 22)
- **Logging:** `hapi-pino`
- **No client-side JavaScript** unless progressive enhancement

### Directory Structure

```
src/
  server.js                — Hapi server, registers all plugins
  config.js                — env vars: PORT, GITHUB_TOKEN, CACHE_TTL_MS
  plugins/
    views.js               — @hapi/vision + Nunjucks, GOV.UK Frontend paths
    router.js              — registers all route modules
    errors.js              — GOV.UK-styled 404 and 500 error pages
  services/
    github.js              — GitHub REST API client (fetch-based)
    cache.js               — single in-memory TTL cache
    prs.js                 — fetches, enriches, and classifies all PR data
  routes/
    index.js               — GET /                (team PRs, no bots)
    all.js                 — GET /all             (all PRs including bots)
    stale.js               — GET /stale           (inactive > 14 days)
    unreviewed.js          — GET /unreviewed      (zero human reviews)
    needs-re-review.js     — GET /needs-re-review (reviewed, commits since)
    refresh.js             — POST /refresh        (manual cache bust)
  views/
    layout.html            — GOV.UK base layout, service name, side nav
    macros/
      pr-table.html        — reusable PR table macro
      filters.html         — filter/sort form macro
    index.html
    all.html
    stale.html
    unreviewed.html
    needs-re-review.html
    error.html
```

---

## GitHub Data Model & Caching

### PAT Scopes Required

- `read:org` — to read team membership and team repos
- `repo` — to read pull requests and reviews on private repositories

> Note: `repo` is a broad scope. A fine-grained PAT scoped to specific DEFRA repositories is preferred if the GitHub organisation supports it.

### Cache Refresh Sequence

On each cache miss (or manual refresh), `prs.js` executes:

1. `GET /orgs/DEFRA/teams/forms/members` — team member logins
2. `GET /orgs/DEFRA/teams/forms/repos` — paginated list of repos the team has been explicitly granted access to
   > Note: this endpoint returns only repos directly associated with the `forms` team. Repos shared via parent teams or org-wide visibility are not returned. Verify coverage against the actual DEFRA team structure after deployment.
3. For each repo in parallel: `GET /repos/DEFRA/{repo}/pulls?state=open&per_page=100`
   > Note: GitHub caps this at 100 results per page. If a repo has more than 100 open PRs, add pagination. For the DEFRA/forms context this limit is expected to be acceptable.
4. For each open PR, in parallel with a concurrency cap of 10:
   - `GET /repos/DEFRA/{repo}/pulls/{n}/reviews`
   - `GET /repos/DEFRA/{repo}/pulls/{n}/commits`
   - On HTTP 429 or 403 (secondary rate limit): exponential backoff starting at 1s, up to 3 retries.

### Bot Detection

A user is a bot if `user.type === 'Bot'` OR `user.login` ends with `[bot]`.

### Cached Data Shape

```js
{
  fetchedAt: Date,
  teamMembers: Set,        // Set of login strings from DEFRA/forms team
  prs: [
    {
      // From GitHub API
      number, title, url,
      repo,                // short repo name (e.g. "forms-runner") — used in filter params
      author, authorType,
      createdAt, updatedAt, draft,

      // Enriched
      reviews,             // non-bot reviews only, chronological
      commits,             // non-merge commits only, chronological

      // Computed
      isStale,             // updatedAt > 14 days ago (inactive, not just old)
      isReviewed,          // reviews.length > 0
      latestReviewAt,      // max(review.submitted_at) across all non-bot reviews, or null
                           // simplified: uses the most recent review regardless of type
      hasUnreviewedCommits // any non-merge commit.date > latestReviewAt
    }
  ]
}
```

All views and the side nav counts are served from the same single cache snapshot, ensuring counts and table data are always consistent.

**Cache TTL:** `CACHE_TTL_MS` env var, defaults to 5 minutes.

**Merge commit exclusion:** A commit is a merge commit if `commit.parents.length > 1`. These are excluded when computing `hasUnreviewedCommits` and from the `commits` array in the cache.

**Review state per reviewer:** For display purposes, the most recent review state per reviewer is used (matching GitHub's own behaviour). For `latestReviewAt`, the maximum `submitted_at` timestamp across all non-bot reviews is used regardless of review type.

**Cached draft state:** The `draft` field reflects the PR state at cache time. A PR promoted from draft since the last cache refresh will still show the Draft status tag until the cache is next refreshed.

### `/refresh` Cooldown

`POST /refresh` busts the cache. To prevent PAT rate limit exhaustion from rapid repeated requests, the endpoint refuses to re-fetch if `fetchedAt` is less than 30 seconds ago, returning a GOV.UK notification banner explaining the cooldown.

---

## Routes & Views

### Side Navigation

Rendered on every page with live counts from the same cache snapshot. Order reflects priority:

```
Needs re-review     (N)   →  /needs-re-review   [highlighted]
Unreviewed          (N)   →  /unreviewed
Team PRs            (N)   →  /
All PRs             (N)   →  /all
Stale               (N)   →  /stale
```

### Shared Page Structure

Every list page includes:

- GOV.UK page heading with caption "DEFRA/forms team"
- Filter form (plain GET, no JS required):
  - **Repository** select — populated from repos with open PRs in current view
  - **Author** select — populated from authors in current view
  - **Sort by** select: Age | Last updated | Title | Author
  - **Direction** select: Newest first | Oldest first
- "Showing X pull requests" row count
- "Last updated X minutes ago — Refresh" above the table
- PR table
- Empty state: GOV.UK inset text "No pull requests match the current filters." + "Clear filters" link

### PR Table Columns

| Column | Notes |
|---|---|
| Title | Links to GitHub PR |
| Repository | Short repo name |
| Author | GitHub login |
| Age | Human-readable (see Age Formatting below) |
| Last updated | Human-readable (same format) |
| Reviews | Count + latest state |
| Status | GOV.UK tags: Draft, Stale, Changes requested, Approved |

### Age Formatting

| Duration | Format |
|---|---|
| < 1 hour | "X minutes ago" |
| < 24 hours | "X hours ago" |
| < 14 days | "X days ago" |
| ≥ 14 days | "X weeks ago" |

### Column Sort Links

Column headers are `<a>` links that carry existing filter params and toggle sort direction. No JS required.

---

## PR Classification Logic

### Team PRs (`/`)

Author login is present in `teamMembers` (fetched from `/orgs/DEFRA/teams/forms/members`). Independent of PAT ownership.

### All PRs (`/all`)

No author filter. Includes bots and external contributors.

### Stale (`/stale`)

`Date.now() - pr.updatedAt > 14 * 24 * 60 * 60 * 1000`

A PR is stale if it has had no activity (commits, reviews, comments, or labels) for more than 14 days. Also displayed as a status tag on all other views.

### Unreviewed (`/unreviewed`)

`pr.reviews.filter(non-bot).length === 0` — no review of any kind from a human developer. Draft PRs excluded.

### Needs Re-review (`/needs-re-review`) — highest priority

```
isEligible = pr.isReviewed
          && pr.hasUnreviewedCommits
          && !pr.draft
```

Where `hasUnreviewedCommits` means at least one non-merge commit was pushed after `latestReviewAt`.

---

## Filtering & Sorting

All state in query params. Plain GET form. Browser back/forward works natively.

### Params

| Param | Values |
|---|---|
| `repo` | repo short name, or empty for all |
| `author` | GitHub login, or empty for all |
| `sort` | `age` \| `updated` \| `title` \| `author` |
| `dir` | `asc` \| `desc` |

### Defaults Per View

| View | Default sort | Default direction |
|---|---|---|
| `/needs-re-review` | `age` | `desc` (oldest unaddressed first) |
| All others | `updated` | `desc` (most recently active first) |

### Select Population

Filter selects are populated from the PRs visible in the current view (before filtering), so they never show options that would yield zero results from the base dataset.
