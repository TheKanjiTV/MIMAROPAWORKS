# Career, profile, employer dataset, and administration update

## Role / Authority

- **Role:** Describe the September 23, 2026 implementation and verification of the requested repairs.
- **Authority:** Project implementation notes based on the running application and its existing API contracts.
- **Must not define:** Real business verification, accredited training, hiring predictions, or fabricated production activity.

---

## 1. Career Development

The Career workspace now includes Workplace Readiness, Resume Optimizer, Interview Practice, Skills Gap Analysis, Career Suggestions, Recommended Training, and Career Coach. Training guides have their own detail routes, activity checklists, and notes. Readiness answers, interview answers, resume drafts, coach progress, and training progress persist in `career_tool_progress`, keyed by the authenticated user and tool.

`GET /api/career/tools` returns the current user's source material, available questions/guides, and saved states. `PUT /api/career/tools/:tool` validates and saves one of `readiness`, `interview`, `resume`, `coach`, or `training:<guide-id>`. Mutations retain the existing session, origin, and CSRF requirements. Unknown fields and foreign owner identifiers are rejected.

Readiness is self-reflection. Interview feedback uses explicit wording checks. Resume editing uses the user's profile and available parsed resume evidence and exports a text draft. Coaching uses a structured plan based on the selected goal and time commitment. These tools are clearly described as guided exercises; they do not claim generative AI, an ATS score, skill certification, or a hiring prediction. Skills Gap Analysis and Career Suggestions retain the existing vacancy/profile comparison APIs and disclose fallback matching.

## 2. Profile and dialogs

The profile editor previously posted the entire profile response, including the read-only `resume` property. The API correctly rejected that extra property with “Only professional profile fields may be updated here.” The form now posts an explicit set of editable fields. The server allowlist remains in place, and uploaded resumes and account credentials remain separate.

Associate Degree is available in profile editing, basic onboarding, and employer job requirements. Matching recognizes it between College Undergraduate and Bachelor's Degree. Education comparisons also recognize legacy capitalization and the existing College Graduate value.

Experience editing now exposes recent role, years of experience, highlights, and career interests. Profile completion uses the stored value instead of an invented fallback. Profile and company dialogs use bounded widths, real padding, 44-pixel close controls, readable labels, mobile scrolling, and a visible save footer. Jobs and the company directory paginate 20 results at a time.

## 3. Administration

`/admin` is the administration overview; `/admin.` redirects there. Admin sign-in remains separate at `/admin/login`, and Admin remains an operator-only role.

The workspace provides:

- Overview totals, 30-day daily activity, jobs by province and industry, application stages, and data that needs attention.
- `/admin/verifications`: searchable, paginated Pending, Verified, and Rejected queues; company details, protected documents, and explicit approval/rejection decisions.
- `/admin/jobs`: a searchable job registry with status, deadline, vacancy, and application information.
- `/admin/accounts`: a searchable account directory with role, verification, and account status.
- `/admin/audit-logs`: searchable actual events, actor, timestamp, entity, and limited event details.

New read APIs are `/api/admin/overview`, `/api/admin/companies`, `/api/admin/jobs`, `/api/admin/accounts`, and `/api/admin/audit-logs`. They require an authenticated Admin and expose no password hashes, session tokens, or resume contents.

Audit records cover Admin sign-in, company profile updates/submission/verification/rejection, job creation/publication/closure, and the actual local dataset insertion. Verification decisions and job lifecycle transitions record their audit event in the same database transaction. Historical events are not invented. Demo-company decisions do not enqueue email to reserved demo addresses.

## 4. Local employer accounts and matching load

The local database received 300 additional fictional employer accounts, 300 complete company profiles, and 300 active jobs: 60 companies per MIMAROPA province. The three existing accounts and original company were preserved. The verified local totals after insertion were 303 accounts, 301 companies, and 300 jobs; a second run inserted zero duplicates.

See [Local demo employers](DEMO_EMPLOYERS.md) for seed commands and login instructions. Each generated employer has a unique password in the ignored `server/data/demo-employers-credentials.csv`. Company and job descriptions explicitly identify sample data. These are local demonstration records, not real hiring offers or reviewed business registrations.

Semantic matching now caps concurrent model requests at four, deduplicates identical work, caches successful scores for five minutes (up to 1,000 entries), and uses a 30-second cooldown after endpoint failure. Existing fallback labels remain intact. Recommendations include active, unexpired jobs from active verified employers.

## 5. Verification evidence

- `npm run build` and `npm run lint` passed. `npm test`: 46 passed, zero failed. MySQL validation: 14 authentication/employer lifecycle tests plus three professional-profile tests passed in isolated databases.
- Live generated-employer login, owned-job retrieval, 300 discoverable jobs, 301 discoverable companies, and sign-out.
- Isolated real-API browser interactions: readiness save/reload, interview answer feedback/reload, resume draft save/download/reload, coach completion/reload, training notes/reload, profile save with Associate Degree, company dialog Escape, and 300-job pagination.
- Desktop and mobile Career/dialog review, with the inline skills-gap link accessibility issue corrected and confirmed.
- Final profile confirmation at 1920px and 320px: Associate Degree and experience fields present, no page/dialog overflow or Axe violations, and Escape closes the dialog. Public landing/login regression at 1440px and 390px also passed.
- Fourteen Admin desktop/mobile views plus filter, search, pagination, reject/verify, and audit-event checks. No page overflow, runtime errors, or API failures. The final audit-ID text contrast adjustment was calculated at 5.81:1 after the bounded browser review.

Local scripts, screenshots, and detailed results are under `.impeccable/review/`. Browser mutations used an isolated in-memory database; they did not alter the user's professional profile or send real email.
