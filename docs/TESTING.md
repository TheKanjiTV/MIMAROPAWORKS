# Testing and quality assurance

[Documentation index](README.md)

## Verified baseline — 13 September 2026

| Check                                | Result / evidence scope                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                           | **22/22 passed**: 14 authentication/business/API tests, 4 career tests, 4 email-service tests                                                           |
| `LIVE_AI_TEST=1 npm run test:mysql`  | **14/14 passed**: the auth/business/API test file against disposable MySQL databases and live local AI                                                  |
| `npm run build`                      | Passed: TypeScript build and Vite production bundle                                                                                                     |
| `npm run lint`                       | Passed: configured ESLint rules                                                                                                                         |
| `python ai-service/semantic_test.py` | Passed: shape `(3, 384)`; related `0.6095032692` > unrelated `0.1903926730`                                                                             |
| Career Home browser QA               | Passed in the verified implementation: desktop/mobile, real AI, search, gap/training mapping, closed-job removal, roles and Axe                         |
| Applicant review browser QA          | Passed in the verified implementation: apply, stored snapshot, protected resume download, status transitions, Job Seeker sync, mobile/Axe and ownership |

The documentation audit reran the automated tests, MySQL/live-AI, build, lint, semantic test and both Career Home and applicant-review browser/Axe checks. Browser scripts below provide the scenario evidence; this is not a measured 100% coverage claim, a security certification or a general model-accuracy benchmark.

## Automated commands

From the project root:

```powershell
npm test
npm run build
npm run lint
```

`npm test` uses Node's built-in runner on `server/*.test.mjs`. SQLite fixtures use in-memory databases and migrations; no application's real accounts are required. The basic run exercises the existing text-overlap fallback deliberately rather than requiring FastAPI for every test.

### MySQL and live AI

```powershell
$env:LIVE_AI_TEST='1'
npm run test:mysql
Remove-Item Env:LIVE_AI_TEST
```

Start MySQL and the AI service first. `server/test-mysql.mjs` sets `TEST_DB_CONNECTION=mysql` and runs **only `server/auth.test.mjs`**, explaining why its count is 14 rather than 22. It reads local DB connection configuration and creates UUID-named `innohack_test_*` databases, then drops them on cleanup. Use a dedicated test credential with create/drop permissions; interrupted runs may require cleanup of confirmed test databases. Do not repurpose a production schema for a manual test.

Without `LIVE_AI_TEST`, the MySQL business test uses the fallback engine. With it, the integration asserts actual `sentence_transformer` responses for vacancies and occupations. The tested Marketing Assistant fixture produced 88% in this MySQL scenario; the different browser career fixture produced 86%. Percentages are input-dependent.

### Independent model test

Use the already working Python runtime, or an activated environment set up from the root README:

```powershell
python ai-service/semantic_test.py
```

The script loads CPU MiniLM, encodes three phrases, checks 384 dimensions and related > unrelated. It does not train a model. Running it alongside the service may load another model copy; avoid competing CPU-heavy checks during a presentation.

## Scenario coverage

| Area               | Existing evidence                                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth/CSRF          | Registration hashing/roles, consent/input validation, invalid Origin/token, sessions, logout, generic failures, recovery, expiry and concurrency                                                       |
| Google/Admin       | Forged Google token rejected; verified-token/account-linking logic through test injection; separate Admin login                                                                                        |
| Employer lifecycle | Profile, private document access, Admin approval/rejection, unverified publishing blocked, owned jobs, draft/active/closed eligibility                                                                 |
| Applications       | Duplicate prevention, owned listing/status, withdrawn protection, preserved score, application retention after close                                                                                   |
| Career             | Real-vacancy gap aggregation, required/preferred distinction and priority, duplicate suppression, no gaps without jobs, normalized-text comparator, sorted/clamped career scores and labelled fallback |
| Training           | Exact skill-tag mapping to the controlled guide catalog                                                                                                                                                |
| Email              | Mocked Brevo contract, omitted empty recipient name, safe thrown-error handling and no-provider development preview                                                                                    |

Some assertions are grouped within a broader integration test; the number of scenarios is not the test-runner count. There is no comprehensive standalone PDF-parser regression suite, full fairness assessment, all-browser matrix or external inbox-delivery suite in the root `npm test` command. The applicant browser fixture uses a minimal file for protected-download testing; that check is not a complete PDF rendering/extraction test.

## Desktop/mobile browser and Axe workflow

The current workspace includes local scripts:

```powershell
node .qa/career-home-check.mjs
node .qa/applicant-review-check.mjs
```

Prerequisites: frontend on 5173, local AI on 8000, Microsoft Edge installed, and the local Playwright/Axe dependencies. Scripts use `chromium.launch({channel:'msedge',headless:true})`, create a browser context, proxy browser API calls into isolated in-memory Express fixtures, and assert no Axe violations in exercised states. Desktop viewport is 1440×1000 and mobile is 390×844. Applicant QA deliberately pauses for rate-limit recovery instead of disabling production limits.

**Portability limitation:** `.qa/` is ignored and its tools/scripts are not part of the root package manifest. These commands work in the verified workspace but are not guaranteed to exist in a fresh Git clone. For handoff, obtain/review the two sanitized scripts from the team; promoting selected tests into a tracked QA package is future maintenance, not an application feature. Never copy the whole `.qa` directory because it contains local artifacts. Its observed versions are Playwright 1.63.0 and @axe-core/playwright 4.13.0.

If setting up only the local tooling after obtaining those scripts, install it into a separate QA prefix so root application dependencies remain unchanged:

```powershell
npm install --prefix .qa --no-save --package-lock=false playwright@1.63.0 @axe-core/playwright@4.13.0
```

This is a setup command, not evidence that scripts are committed. Preserve any local tooling first. Screenshots are local ignored artifacts, not public user records.

## Manual acceptance checklist

1. Anonymous `/` shows the Landing Page; completed Seeker login/root resolves to `/jobs`; Employer/Admin routes enforce their roles.
2. A controlled profile and readable PDF yield suggestions; inspect and approve rather than assuming every parser result is correct.
3. Publish a verified employer's draft. Confirm an active job appears with actual model engine while 8000 is available.
4. Apply only after confirmation. Inspect the saved match snapshot, then change the current profile and verify the historical score is unchanged.
5. Employer marks Under Review, then Shortlist. Refresh Job Seeker My Applications. Test another application for Not Selected and another for withdrawal.
6. Employer B cannot access Employer A's applicant, resume or status action. A Job Seeker cannot use Employer APIs.
7. Close the job; confirm recommendations/Home remove it while existing applicants remain.
8. Inspect gaps from real skills and affected jobs. Follow a mapped training guide. With no current vacancy, career suggestions can remain but vacancy gaps disappear.
9. Test desktop, narrow mobile, keyboard focus, labelled fields, confirmation dialogs, loading/errors and screen-reader status feedback. Axe complements, not replaces, human review.
10. Point an isolated test app at an unavailable AI URL and confirm vacancy fallback remains usable and career fallback is labelled. Do not secretly present fallback scores as transformer scores.

## Documentation QA

For this handoff: cross-check route tables against Express/FastAPI source, dependency versions against lockfile/runtime metadata, local command syntax, relative links, Mermaid rendering, ignored sensitive paths and scans for secret-like values/personal absolute paths. No user-upload contents or real credentials belong in documentation. External provider delivery, team identities, partnerships, legal notices and measured outcomes require separate human confirmation.
