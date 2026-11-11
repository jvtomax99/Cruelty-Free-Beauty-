# CLAUDE.md: Cruelty-Free Beauty

## What this is

**C.F.B. (Cruelty-Free Beauty)**, "Cruelty free looks best on skin." A
phone-first installable web app for makeup shoppers: is this brand
cruelty-free (with the proof), and is it right for me. Built by Jose for the
founder (name TO FILL in SPEC.md). Plain HTML, CSS and JS, no build step.
Map of files: `docs/ARCHITECTURE.md`. What and who: `SPEC.md`. Look:
`DESIGN.md`.

## This project: how the general rules apply here

- **Plan and phases:** `SPEC.md` ("Phases"). Phase 1 (look and shell) done
  2026-11-10, phase 2 (brand data) 2026-11-11. Next: phase 3, directory.
- **Real user:** the founder (TO FILL). Remind Jose to check plans, brand
  rules and any words that speak for them with the founder.
- **Hosting:** GitHub Pages from `main`, root folder, at
  `jvtomax99.github.io/Cruelty-Free-Beauty-/`. Pages stays off until phase 3
  (a live site with no brands helps no one); turning it on is a repo
  setting, so ask Jose. No branch previews: the preview is Playwright
  screenshots (390 px, then 1440 px) served from the parent folder, plus a
  "try this" list.
- **Offline worker:** bump `CACHE_VERSION` in `sw.js` in every change to a
  file it precaches, or returning users keep the old app.
- **Network:** peta.org, crueltyfree.peta.org, leapingbunny.org,
  crueltyfreeinternational.org and world.openbeautyfacts.org are allowed in
  the Default environment (2026-11-10). Exponent and ACTAsia refuse
  automated readers; cite the certifiers' own pages instead.
- **Claims need sources.** Whether a brand is cruelty-free changes (parent
  companies, sales where animal testing is required). Every such claim links
  its source and the date it was checked; never state one from memory.
- **Handoffs:** new handoffs go in root `HANDOFF.md`. None exists now.
- **Brand sites:** read them with curl or Playwright from Bash (subagents'
  WebFetch skips the proxy and fails). Verify every quote before saving.
- **Rule docs:** `docs/design-rules.md`, `docs/assets.md`,
  `docs/cleanup-audit.md` and `docs/refactor.md`. `docs/CLEANUP.md` does not
  exist yet. Assets are listed in `CREDITS.md`. Budget: $0 (free only).
- **Site check.** Every pull request runs `.github/site-check.cjs` ("Site
  check": missing files, links starting with "/", script errors at phone and
  desktop width). It must be green before asking Jose to push. Run it with
  `node .github/site-check.cjs index.html`. A new page goes into the list in
  `.github/workflows/site-check.yml`.

- **Public repo, paid assets.** The repo is public (checked 2026-11-10), so paid raw files can't be committed (docs/assets.md, section 9) unless Jose makes it private.
- **Taste skill.** Saved in `.claude/skills/taste/` (Senlin's, MIT; `SOURCE.md` there says where from). It asks for the Playwright MCP server; in a cloud session use the Playwright already installed instead (run its `references/extract.js` with `page.evaluate`).
- **Refactor prompt.** docs/refactor.md, run when Jose asks for "Refactor: CLEANUP.md items ...".

# General rules (all of Jose's website projects)

Same in every project. Where the "This project" section above differs, it wins.

## Planning

- **Challenge me.** Question my ideas; no sugarcoating. Say plainly when a plan is bad, why, and what's better; name the biggest risk I'm missing. Skip small stuff. Once I've decided after hearing you out, build it my way.
- **SPEC.md** (repo root): what it does and who for (if not me, who and what they need); one or two "Done when" lines per feature; "Not in v1"; "Later"; "Phases" (build order, a checkbox list per phase, each phase one or two sessions; check it off when done and verified). New project: write it with me before any code. Existing project without one: draft it from the code, then ask me to fill the gaps and "Not in v1". Keep it current. If I ask for something not in it or on "Not in v1", say so and ask: now, or "Later"?
- **Cleanup check.** After a phase is checked off, read "Last audit" at the top of docs/CLEANUP.md. If 3 phases have been completed since then, or it's been over 30 days, or the file is missing, offer docs/cleanup-audit.md with buttons: "Run it now" (recommended), "Next session", "Skip this time". If cleanup-audit.md is missing, ask me for the prompt and save it there.
- **docs/ARCHITECTURE.md**: short and current (main folders, key files, how data moves). Read it at session start instead of exploring; update it when the structure changes.
- **Big feature** = a new page or screen, a new kind of stored data, or a new outside service. Everything else is small.
- **Big features and new projects:** first look at 2 or 3 similar tools and tell me in a few lines how they do it and where mine can be better (new ideas go to "Later" unless I approve). Before any coding, use plan mode: what you'll build and how, in plain words, with assumptions listed separately; wait for my OK. Whenever I correct you, update SPEC.md. In a scheduled or background run, do small changes only and leave the plan. If the real user isn't me, remind me to check the plan with them.

## Proof and reporting

- **Show me it works.** I can't check code, so every feature ends with proof I can see. Never say "fixed", "works" or "done" without running or testing it; say what you checked, or "not verified" and why. Small change: a screenshot or a short "try this" list. Big feature: check its "Done when" line and give me the link to a preview I can open on my phone (what a preview is here: "This project").
- **Review before the pull request.** After a phase or big feature, and before opening its pull request, a separate reviewer subagent checks the changes for bugs, broken behavior and mismatches with SPEC.md, without seeing how the code was written. Fix what it finds; tell me in 2 or 3 lines what it caught.
- **Reports:** status updates extremely concise, fragments fine. Explanations in plain full sentences. After a meaningful change, 2 or 3 plain sentences on what changed and why.
- **Ask first** before: deleting data or files I may need, changing logins or accounts, pushing to main, deploying to the live site, anything that costs money.

## Usage

- **Keep the session light.** Read only the parts of files you need. Show me only the lines of logs and test output that matter. Big searches and many-file reads go to a subagent so only its summary comes back.
- **Helpers.** Haiku subagents for repetitive work (searching, test results, summaries, checklists). Planning, decisions and code changes stay on the main model; check helpers' results before relying on them.
- **New session triggers** (tokens or share of context, whichever first; a new session costs 20k to 40k to catch up): under 150k or 50%, keep going. 150k to 300k or 50% to 75%, finish the step, then hand off. Over 300k or 75%, hand off now, even mid-task. Over 100k and the next task is unrelated: hand off. Over 100k and I tell you I've been away over an hour: hand off. Ask once with buttons, "Start a new session" (recommended) and "Keep going"; if I keep going, don't ask again until the next trigger. If I say keep going past 75%, warn me once and write HANDOFF.md anyway (auto-compact is off, so a full session just stops).
- **HANDOFF.md** (repo root, short, pointing to what exists): the goal and exact next step; what's done (commits) and what's left; this session's decisions (also added to SPEC.md); files to look at first. Overwrite it each time; in a cloud session commit and push it on the current branch. At session start, if it exists, read it first and confirm the next step with me. Delete it once its work is done (phase checked off, pull request opened).
- **Effort.** No ultracode or max effort unless I ask.
- **Keep CLAUDE.md lean.** Suggest a one-line addition for a lasting decision; remove lines that no longer apply. Keep it short: it loads every session.

## Environment and installs

- **Settings to save** (API key, environment variable, setup step): one copy-and-paste block in the format that place expects, plus one line saying exactly where to paste it. Secrets I hold: YOUR_VALUE_HERE. Never put secrets in code or commit them.
- **Ask first, with buttons** (recommended first, plus Skip), before installing anything that changes my computer, costs money, needs an account or connects to my apps (plugins, MCP servers, connectors, system programs). Say what it is and why it helps. On yes, install it yourself and check it works. Don't ask about what's installed already. In a scheduled or background run, skip it and tell me what you skipped and why.
- **Project packages:** install without asking, mention them, and add them to the package list (package.json, requirements.txt) so one command restores everything.
- **Making installs stick:** the environment's setup script runs the project's install command; for system tools outside the project, give me the copy-and-paste line to add to it.

## Git and GitHub

- **Branches.** Never commit to main. One branch per feature or fix with a plain name (add-quiz-scores). Pull the latest main and check for uncommitted work first. (A cloud session handed a branch name uses it.)
- **Commits.** Small steps, plain-English messages ("Add score screen after practice quiz"). Never commit secrets, keys or .env files; keep them in .gitignore.
- **Pushing.** A feature branch: push freely. Into main: (1) a pull request with a short plain summary, the "Done when" check and the preview link (or screenshots where there are no previews); (2) a phone notification naming the change and saying it needs my "push" (if you can't notify, put that at the very top of your message); (3) wait for my OK before merging.
- **Never without asking** (if I ask for one, first explain what it will do and what can't be undone): force push; deleting a branch with work not in main; rewriting or resetting history (git reset --hard, rebase on main); changing repo settings (like making a repo public).
- **Big files.** GitHub rejects files over 100 MB: warn me before committing one and suggest compressing it or Git LFS.
- **Undo.** After a merge, one line on how to undo it if it breaks the live site.

## Assets and design

- **Assets** (models, textures, icons, fonts, images, sounds, templates): read docs/assets.md first and follow it. If it's missing, stop, ask me to paste my asset rules, and create it before starting.
- **Design** (any page or UI): read docs/design-rules.md and DESIGN.md first and follow them. If design-rules.md is missing, stop, ask me to paste my design rules, and create it before starting.
