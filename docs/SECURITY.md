# Security and privacy

[Documentation index](README.md) · [API authorization](API.md)

This describes implemented controls and known limits, not a penetration-test certificate or assurance of legal compliance. Resumes, business verification documents, email addresses and token-bearing mail previews can contain sensitive personal information.

## Implemented controls

| Area            | Current implementation                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passwords       | Argon2id hashes, server validation and generic invalid-login errors; plaintext passwords are not stored                                                                               |
| Sessions        | Cryptographic opaque tokens, stored SHA-256 hashes, HttpOnly/SameSite=Lax cookies; Secure and `__Host-` name in production; rotation at authentication and revocation at logout/reset |
| Lifetimes       | Anonymous session 1 hour; normal authenticated session 12 hours; remember-me 30 days; verification 24 hours; password reset 30 minutes                                                |
| CSRF            | Exact Origin, session-bound token and JSON content type on mutations; explicit protected multipart exceptions only for upload routes                                                  |
| Request limits  | General API 120/minute; authentication 20/15 minutes; recovery/resend 5/15 minutes. Default in-process rate-limit store; not distributed enforcement.                                 |
| HTTP headers    | Helmet/CSP, no-store API responses, no-referrer policy and disabled x-powered-by                                                                                                      |
| Persistence     | Parameterized statements, validated database identifier, transactional token consumption and profile updates                                                                          |
| Roles           | Public role choices exclude Admin; Admin login/create separate; Employer and Job Seeker APIs enforce roles server-side                                                                |
| Ownership       | Owned application listing/withdrawal, owned employer jobs/applicants/status actions, application-linked private resume download                                                       |
| Publishing      | Verified company required before direct publish or draft activation                                                                                                                   |
| Applications    | Active/deadline/profile checks and database unique job/seeker pair; no auto-rejection threshold                                                                                       |
| Uploads         | Multer multipart handling, MIME/size constraints; PDF extension/nonempty check and PyMuPDF readability for resumes                                                                    |
| Downloads       | Protected backend handlers, storage-root containment checks, safe attachment filenames; document directories are not statically served                                                |
| Identity tokens | Google server-side verification and proof before linking existing identities                                                                                                          |

Use of the system does not make a job, employer or applicant legally certified. Admin verification is a human review workflow.

## Access boundaries

- A Job Seeker reads their own profile/applications and removes their own resume. They cannot use Employer/Admin workflow APIs.
- An Employer accesses applications only through jobs they own. A real application is required for applicant resume download; another Employer cannot use a guessed ID.
- Withdrawn applicants are historical, not active candidates. Only submitted/under_review records can be changed by Employer status actions.
- Admin can review company documents but does not inherit Employer application-action privileges.
- Career suggestions, skill priorities and training recommendations are Job Seeker development tools, not hidden Employer hiring inputs.

## Private storage and data handling

`server/data/resumes`, `server/data/verification-documents` and `server/data/mail-preview` stay private and ignored by Git. File writes request owner-only permissions, but Windows ACLs and actual deployment filesystem permissions still need operator management. There is no public static path or permanent external document URL.

The current analyzer returns suggestions without raw resume text. Candidate normalization does not deliberately include name, email, phone, password or account IDs. Accepted free-text experience snippets can nevertheless contain information supplied in a resume: this is not an automated PII-redaction guarantee. Normal logging avoids resume contents; AI diagnostics include job titles and scores.

Profile/score distinctions are important: application scores are immutable application-time values, but profile display/latest resume retrieval is current. There is no frozen resume consent/version record per application. Deleted resume files do not automatically remove approved skills. A production retention, deletion, consent and backup policy requires human/legal review.

## Email and secret safety

Configuration precedence: Brevo → Resend → SMTP → preview, based on which providers are configured. No runtime failover is implemented. The worker retries provider exceptions and retains failed messages until retry/age limits. Queue rows and previews contain raw one-use links despite action-token hashes being stored separately; secure both database and private preview directories.

Current caveat: the Resend adapter awaits `emails.send` but does not explicitly test a returned `result.error` when the SDK returns an error object without throwing. Such a result can be treated as success by the existing wrapper. Therefore documentation must not guarantee delivery/failover on every Resend rejection. No application behavior was changed as part of this documentation task.

Provider keys, SMTP credentials, database passwords and Admin passwords must never use `VITE_*` names. The Google Web client ID is public; a client secret is neither needed nor included by this flow. Use `.env.example` placeholders only. Clear illustrative Brevo placeholders for local preview mode; nonempty placeholders select Brevo and can cause delivery failure.

The development test-email route requires Admin **and** nonproduction mode. No email to a real recipient was sent by this documentation audit. Provider-mocked tests are not inbox-delivery tests.

## Current production-hardening gaps

1. FastAPI has no authentication/rate limits or independent upload-size enforcement. Keep it on loopback; any remote deployment requires a protected service boundary.
2. Employer verification validates declared MIME/size, not magic bytes, malware or document authenticity. The backend accepts at least one document and stores generic categories; it does not enforce distinct registration/permit completeness.
3. Company edits do not invalidate verification automatically; existing active jobs are not automatically hidden after a company is rejected. Publishing authorization is enforced, but a broader review/revocation policy is not implemented.
4. Job field validation is limited; frontend constraints are not a substitute for future full server validation of enum/range/date relationships.
5. No distributed rate limiter, document retention scheduler, audit/status-history table, automated backups, production monitoring, penetration test or formal fairness evaluation is included.
6. Original parsing rules are limited and can produce false suggestions. The single non-skill merge flag and basic-profile re-completion have preservation limits; see [Architecture](ARCHITECTURE.md).
7. Legacy recommendation endpoint filtering and application scoring have documented differences. Scores are aids, not calibrated probabilities or grounds for automatic exclusion.

## Repository hygiene

`.gitignore` excludes `.env` and environment variants (except sanitized `.env.example`), `node_modules`, build output, local QA artifacts, private `server/data`, Python virtual environments/bytecode, model caches/weights, logs and temporary files. Runtime directories are created by code; no private file needs to be committed as a placeholder.

For local development only, `npm run admin:promote -- user@example.com` is an operator CLI, not a public route. It refuses production mode, absent/inactive accounts and malformed/multiple email arguments. It changes `users.role` to `admin` and its audit timestamp only; it deliberately does not reset passwords, modify sessions, select a public role, or alter profile fields. Admins still use the separate `/admin/login` route.

This checkout has no `.git` metadata. Ignore-rule and documentation scans can be checked locally, but no historical commit/index audit is possible here. Before publishing, initialize/use the intended repository, inspect staged changes, and audit repository history with the team's secret-scanning tooling. Ignore rules do not remove secrets already committed elsewhere. If a secret has been exposed, revoke/rotate it through its provider rather than merely deleting a line.

The team must supply an operational security contact and approved privacy/retention notices before a real-user deployment. No fictitious disclosure address is provided.
