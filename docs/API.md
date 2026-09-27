# API reference

[Documentation index](README.md) · [Security](SECURITY.md)

Source: `server/app.mjs` and `ai-service/main.py`, inspected 13 September 2026. The tables describe the existing implementation, not proposed routes.

## Conventions

Application paths below include `/api`. In development, the browser calls them through port 5173 and Vite proxies to Node on 3001. FastAPI is a separate loopback service on 8000.

- Authentication uses an HttpOnly cookie, not a bearer/JWT token. Call `GET /api/auth/session` to initialize/read the session and obtain `csrf`.
- Every non-GET/HEAD/OPTIONS application request requires the exact configured `Origin`, a session cookie and `X-CSRF-Token`. This includes registration, login, token consumption and multipart uploads.
- Default bodies are JSON objects. Multipart is allowed specifically for resume and employer verification uploads. JSON limit is 16 KiB.
- Most success responses use 200; creation/queue/delete exceptions are listed below. Errors generally use `{ "message": "Readable explanation" }`.
- Common errors: 400 invalid input/state, 401 not logged in, 403 role/CSRF/completion restriction, 404 missing or inaccessible resource, 409 duplicate/already selected, 429 rate limit. Upload limit/parser failures may also use the global error handler.
- Timestamps are Unix milliseconds; scores generally use 0–1 components and integer overall percent. MySQL DECIMAL score values may be serialized as strings: clients should normalize numerically.
- IDs in API requests are opaque implementation identifiers. Do not display authentication internals to users.

## Authentication

| Method and path                      | Access / important fields                                                           | Response and rules                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/api/auth/session`              | Anonymous or signed in                                                              | `{user, csrf}`; initializes an anonymous session if needed                                                                                                |
| POST `/api/auth/register`            | Anonymous session; `fullName`, `email`, `password`, `confirmPassword`, `agree:true` | `{user,csrf,redirect}`; name 2–100, password 8–128 characters; hashes password, queues verify link, rotates session; public role is not caller-controlled |
| POST `/api/auth/login`               | Anonymous session; `email`, `password`, optional `remember`                         | Session and role-aware redirect; generic invalid-credentials errors; Admin uses separate endpoint                                                         |
| POST `/api/auth/admin/login`         | Anonymous session; same credential fields                                           | Admin-only login; not public Admin registration                                                                                                           |
| POST `/api/auth/logout`              | Session; `{}`                                                                       | Revokes current session and clears cookie                                                                                                                 |
| POST `/api/auth/google`              | Session; `credential`, optional `agree`, `remember`, `linkingPassword`              | Verifies Google ID-token audience/signature/claims. Creates or links only with required proof; 503 if client ID missing                                   |
| POST `/api/auth/forgot-password`     | Session; `email`                                                                    | Generic message regardless of account existence; queues reset if appropriate                                                                              |
| POST `/api/auth/reset-password`      | Session; `token`, `password`, `confirmPassword`                                     | Consumes valid reset hash, changes password, revokes sessions/tokens; user must log in again                                                              |
| POST `/api/auth/resend-verification` | Authenticated; `{}`                                                                 | Replaces link token for unverified user and queues email; already verified users do not generate another token                                            |
| POST `/api/auth/verify-email`        | Session; `token` from verification link                                             | Consumes 64-hex-character token and sets email verified; no `{email,otp}` contract exists                                                                 |
| POST `/api/test-email`               | Development **and Admin**; `email`                                                  | 202 queued test message; returns 404 in production or for non-Admin users                                                                                 |

Verification links last 24 hours; reset links 30 minutes. Token values are obtained from email/private preview and must not be logged. The frontend reads the URL fragment, then posts the token. Public account responses whitelist identity/profile-state fields rather than returning password hashes.

Local development operator command: `npm run admin:promote -- user@example.com` is deliberately not an API. It is disabled for `NODE_ENV=production`, requires an existing active account in the currently configured database, and changes only `users.role` plus `updated_at`. The promoted user must use `/admin/login` and then `/admin/verifications`.

## Job Seeker and career development

| Method and path             | Access / important fields                                                                                                                      | Response and rules                                                                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST `/api/role`            | Authenticated; `role: job_seeker` or `employer`                                                                                                | `{user,redirect}`; 409 if already selected; Admin is not accepted                                                                                                                 |
| GET `/api/profile`          | Authenticated, own account                                                                                                                     | `{user,profile}` with basic profile fields or null                                                                                                                                |
| PUT `/api/profile`          | Job Seeker; strings `province`, `municipality`, `education`, `skills`, `preferred_job`, `work_setup`; integer `step:0..2`, optional `complete` | `{user,redirect}`; skills is comma-separated here, not an array. Completion requires all six nonempty fields, MIMAROPA province and verified email; partial progress can be saved |
| GET `/api/job-seeker/home`  | Job Seeker, selected role, completed matching profile                                                                                          | `{recommendations,skills_gap,careers,training,applications}`; actual active/unexpired jobs, controlled career comparisons and own status totals                                   |
| GET `/api/jobs/recommended` | Same completed-seeker requirement                                                                                                              | `{recommendations}` sorted by weighted final score; active-status filtering. Unlike Home, legacy endpoint does not additionally filter deadline                                   |
| GET `/api/dashboard`        | Verified, completed Job Seeker                                                                                                                 | Existing account summary/legacy dashboard access; incomplete users receive an onboarding response                                                                                 |

Home search is a frontend filter over actual evaluated vacancy records; there is no separate search-query API or fake server search response. Career routes all reuse the Home endpoint. Career percentages are semantic compatibility; fallback is explicitly `skills_overlap_fallback`.

Example basic-profile body (fictional):

```json
{
  "province": "Oriental Mindoro",
  "municipality": "Calapan City",
  "education": "Bachelor's Degree",
  "skills": "Canva, Customer Service, Social Media Management",
  "preferred_job": "Marketing Assistant",
  "work_setup": "On-site",
  "step": 2,
  "complete": true
}
```

## Resume

| Method and path                             | Access / important fields                                                                                       | Response and rules                                                                                                                                                                   |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET `/api/resume`                           | Authenticated; own rows                                                                                         | `{resume}` with latest metadata and parsed analysis, or null; no private storage path                                                                                                |
| POST `/api/resume`                          | Job Seeker; multipart **`resume`**, one PDF up to 5 MiB                                                         | 201 with metadata/analysis when analyzer responds; 202 with failed status/message on parsing/service error. MIME, extension, nonempty input checked; PyMuPDF detects corrupt content |
| POST `/api/resume/:id/merge`                | Job Seeker, owns completed analysis and has a basic profile; `skills: string[]`, optional `use_resume: boolean` | Message and merged skills. Edited skills allowed within limits, aliases normalized. `use_resume` collectively selects non-skill suggestions; no independent field flags              |
| DELETE `/api/resume/:id`                    | Authenticated owner                                                                                             | 204; deletes selected metadata/file, not skills already merged                                                                                                                       |
| GET `/api/employer/applications/:id/resume` | Employer owning the application's job                                                                           | Protected attachment for applicant's latest resume. 404 for missing/inaccessible resume; no public URL                                                                               |

Only suggestions/metadata, not raw extracted text, are returned by the current analyzer. Analysis failure does not itself replace the saved manual profile. See [Architecture](ARCHITECTURE.md) for merge/re-completion limits. There is no general public resume-download endpoint.

## Job details and applications

| Method and path                       | Access / fields            | Response and rules                                                                                                                       |
| ------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/api/jobs/:id`                   | Authenticated              | `{job,match,applied}`; job must be active and unexpired. Match is populated for a completed Job Seeker profile; skill arrays are decoded |
| POST `/api/jobs/:id/apply`            | Completed Job Seeker; `{}` | 201 `{message,application}` with score snapshot concept. Job must be active, unexpired and not previously applied to; 409 duplicate      |
| GET `/api/applications`               | Job Seeker                 | `{applications}` for current seeker, newest first, including job/company/location and saved component/skill fields                       |
| POST `/api/applications/:id/withdraw` | Owning Job Seeker; `{}`    | `{status:"withdrawn"}`; source must be submitted/under_review/shortlisted; row retained                                                  |

Apply calculates scores at application time, which may differ from an earlier displayed recommendation because of current input or helper differences. The database unique constraint also prevents duplicate insertion. Employers/Admins cannot Apply. Closing or expiry blocks new submissions without deleting historical applications.

## Employer profile, verification and jobs

| Method and path                       | Access / fields                                                   | Response and rules                                                                                                             |
| ------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| GET `/api/employer/profile`           | Employer                                                          | `{profile}` or null; own company only                                                                                          |
| PUT `/api/employer/profile`           | Employer; see company fields below                                | Saves/upserts own profile; required company/contact data and email validation                                                  |
| POST `/api/employer/verification`     | Employer with saved profile; multipart **`documents`**, 1–3 files | PDF/PNG/JPEG MIME, 8 MiB per file; stores privately, sets pending, clears rejection reason, queues submission email            |
| GET `/api/employer/jobs`              | Employer                                                          | `{jobs}` restricted to owner; skill JSON fields are returned in existing database form, unlike decoded recommendation payloads |
| POST `/api/employer/jobs`             | Employer with profile; job body below                             | 201 `{id,status}`; draft by default; `publish:true` requires verified company                                                  |
| POST `/api/employer/jobs/:id/publish` | Verified Employer and owned draft; `{}`                           | `{status:"active"}`; no second Admin job approval                                                                              |
| POST `/api/employer/jobs/:id/close`   | Employer and owned active job; `{}`                               | `{status:"closed"}`; retains applicants                                                                                        |

Required company fields: `company_name`, `industry`, `province`, `municipality`, `contact_person`, `contact_position`, `business_email`, `contact_number`. Optional: `description`, `address`, `company_size`, `website`. Contact email may differ from the user's login email. The UI guides business registration/permit/representative ID, but uploaded metadata is currently generic `verification`, not separate typed categories.

Job body: `title`, `description`, `industry`, `province`, `municipality`, `employment_type`, `work_setup`, optional `salary_min`, `salary_max`, `vacancies`, `education_required`, `experience_required`, `required_skills:[]`, `preferred_skills:[]`, `application_deadline` as milliseconds, and optional `publish:true`. Title, description, industry, province, municipality and company profile are checked server-side; UI adds richer field guidance. Do not infer exhaustive server-side enum/date/salary validation from the form alone.

`normalized_job_text` is built and stored during creation (including drafts); publishing changes lifecycle status. The existing backend has **no** `GET/PUT /api/employer/jobs/:id` endpoint. Frontend detail pages derive an owned job from the list response. Do not integrate an imaginary Edit API.

## Employer applicants

| Method and path                              | Access / fields               | Response and rules                                                                                                                                                       |
| -------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET `/api/employer/applicants`               | Employer                      | `{applications}` joined only to owner jobs. Includes stored score/skills, whitelisted current profile and resume availability; backend sorts stored score desc/date desc |
| POST `/api/employer/applications/:id/status` | Employer owning job; `status` | Accepts `under_review`, `shortlisted`, `rejected` only from submitted/under_review. Returns authoritative `{status}`; inaccessible/non-actionable returns 404            |
| GET `/api/employer/applications/:id/resume`  | Same ownership boundary       | Protected download as described above                                                                                                                                    |

Applicant detail and job-specific list screens reuse the scoped list; there is no separate applicant-detail GET endpoint. Frontend Newest/Oldest/Highest Match sorting uses existing timestamps and stored overall percentage. Withdrawn rows remain in history and have no recruitment actions. Internal rejection reasons are **not** a supported status-body field.

| API value      | User-facing label |
| -------------- | ----------------- |
| `submitted`    | Applied           |
| `under_review` | Under Review      |
| `shortlisted`  | Shortlisted       |
| `rejected`     | Not Selected      |
| `withdrawn`    | Withdrawn         |

Job Seeker status refreshes from the same application row, not a separate frontend record. Admin does not automatically impersonate Employer actions.

## Administrator

| Method and path                                      | Access / fields                                               | Response and rules                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| GET `/api/admin`                                     | Admin                                                         | Legacy protected Admin summary                                                       |
| GET `/api/admin/employer-verifications`              | Admin; query `status=pending` (default), verified or rejected | `{employers}` sorted by profile update time                                          |
| GET `/api/admin/employer-verifications/:id`          | Admin; ID is employer user's ID                               | `{profile,documents}`; metadata excludes filesystem paths                            |
| GET `/api/admin/verification-documents/:id`          | Admin; document ID                                            | Private download with storage-root validation                                        |
| POST `/api/admin/employer-verifications/:id/approve` | Admin; `{}`                                                   | Sets verified status/time/Admin ID, clears reason, queues approval email             |
| POST `/api/admin/employer-verifications/:id/reject`  | Admin; `rejection_reason` nonempty, max 500                   | Sets rejected, records reason/Admin ID, clears verified time, queues rejection email |

There is no review-history API/table or suspension action. Queue dates derive from current profile timestamps, not an immutable submission-event history.

## Local AI service

These paths are **not** prefixed with `/api`. Node invokes them server-to-server. Bind loopback as documented: no API authentication or upload-size/rate enforcement exists inside FastAPI itself.

| Method/path                            | Body                                                        | Response                                                                                                                                                                     |
| -------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/health`                          | None                                                        | `{status:"ok",model:"paraphrase-multilingual-MiniLM-L12-v2",embedding_dimension:384}`; 503 if model absent                                                                   |
| POST `/ai/semantic-score`              | JSON `candidate_text`, `job_text`, each 1–20,000 characters | `{semantic_score:0..1,engine:"sentence_transformer",model}`; 422 validation error, 503 model unavailable                                                                     |
| POST `/ai/resume/analyze`              | Multipart field **`file`**, PDF bytes                       | `status`, `page_count`, `resume_text_available`, `detected_skills`, `detected_education`, `detected_course`, `detected_job_titles`, `experience_snippets`; corrupt PDF → 400 |
| GET `/docs`, `/redoc`, `/openapi.json` | Local development                                           | Automatic FastAPI documentation/schema                                                                                                                                       |

A no-text PDF returns completed analysis with `resume_text_available:false` and empty/null suggestions; the Node upload handler marks that resume failed for review purposes. No OCR or structured extraction by Sentence Transformers is performed.
