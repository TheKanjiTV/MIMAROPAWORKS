# Documentation index

Technical and MinSU InnoHack 2026 reference for the source inspected on 13 September 2026. Start with the [root README](../README.md).

| Document                                            | Audience and purpose                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [Architecture](ARCHITECTURE.md)                     | Developers and judges: boundaries, context/container diagrams and dynamic flows    |
| [Database](DATABASE.md)                             | Developers: actual schema, migrations, relationships and snapshot semantics        |
| [API](API.md)                                       | Integrators: current methods, payload concepts and authorization                   |
| [Security and privacy](SECURITY.md)                 | Maintainers: implemented controls and remaining production risks                   |
| [Testing](TESTING.md)                               | QA team: reproducible commands, evidence scope and limitations                     |
| [InnoHack documentation](INNOHACK_DOCUMENTATION.md) | Writers/presenters: reusable narrative, requirements and sustainability hypotheses |
| [Demo script](DEMO_SCRIPT.md)                       | Presenters: preparation, live walkthrough and honest fallback narration            |

## Source-of-truth policy

Use current implementation over older prompts. `server/database.mjs` contains migration definitions; there is no migrations directory. `server/app.mjs` owns business/API behavior; `server/career.mjs` owns controlled career/training data. `ai-service/main.py` owns local inference and rule-based PDF analysis. The lockfile supplies resolved Node package versions; Python requirements are unpinned, so documented runtime versions are observations.

Core Recruitment MVP v1 and Career Development Phase 1 are implemented. Workplace readiness, interview practice, labor analytics and offer/hired workflows remain planned. Training guides are internal practice resources, not qualifications.

## Team information still needed

Before formal submission, supply the approved team name, member names/roles, adviser, official event/campus wording, repository URL, approved logo/branding ownership, license decision, contact address and any required paper template. Validate proposed partnerships, business model and pilot plans with stakeholders. Do not replace these with invented facts.
