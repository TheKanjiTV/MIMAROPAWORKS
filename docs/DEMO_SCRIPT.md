# Demo script — MIMAROPA Works

[Documentation index](README.md) · [Testing](TESTING.md)

## Preparation

Use **fictional or explicitly consented demo data** and distinct Job Seeker, Employer and Admin sessions/browser profiles. Do not project private emails, tokens, API keys or real identity documents. Keep a sanitized text-based resume and verification samples ready.

1. Start MySQL if selected. Run `npm run db:status`; latest marker is `007_applications`.
2. Start the existing CPU AI runtime with the README Uvicorn command. Check `/health`: ok, MiniLM, 384 dimensions.
3. Run `npm run dev`; open the app at `http://127.0.0.1:5173`.
4. Prepare MIMAROPA Digital Solutions, Calapan City, Oriental Mindoro, and an active Marketing Assistant vacancy. Admin must verify the company before publishing. Ensure its deadline has not passed.
5. Use a seeker with Customer Service, Canva and Social Media Management; add other skills only if actually reviewed into the profile. Run the matching view first to warm inference.
6. Check there is no existing application for this demo seeker/job pair. Withdrawal does not permit reapplication because uniqueness is retained. Use another consented demo account or a fresh demo job when needed; do not delete historical records for presentation.

Observed reference fixture: job 86%, Marketing Assistant occupation 80%, Social Media Associate occupation 66%. Display whatever the real current result is. Do not adjust profiles or scores solely to force those exact numbers.

## Main walkthrough — approximately 6–8 minutes

| Step | Screen/action              | Suggested narration / evidence                                                                                                                                                                                              |
| ---- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Job Seeker profile         | “We begin with location, education, skills and work preferences. Registration does not ask for all career details at once.”                                                                                                 |
| 2    | Resume upload/review       | Upload a readable PDF. Show detected skills and choose what to accept. “PDF extraction and rules suggest information; the user reviews it before it becomes profile data.”                                                  |
| 3    | `/jobs`                    | Show an actual active Marketing Assistant vacancy and match percentage. “The profile is compared locally with the job, not a sample score.”                                                                                 |
| 4    | View Job                   | Open full details, Why You Match, matched/missing skills and requirements. “The score is an aid, not a hiring guarantee.”                                                                                                   |
| 5    | Apply                      | Click Apply Now, show confirmation, then Submit Application. “Only active, unexpired vacancies accept one application per seeker.”                                                                                          |
| 6    | Employer Applicants        | Switch to the owning employer. Open Applicants and select Marketing Assistant. “These are actual applicants, not every registered user.”                                                                                    |
| 7    | Applicant Details          | Show stored overall/component scores and matched skills. “The match at application time is preserved even if the current profile changes later.”                                                                            |
| 8    | Protected resume           | Download/open only the sanitized resume through View Resume. “Access is tied to this application and the employer who owns the job.”                                                                                        |
| 9    | Status action              | Deliberately mark Under Review, then confirm Shortlist. “The employer makes the decision. Opening a profile does not automatically change status.”                                                                          |
| 10   | Job Seeker `/applications` | Refresh/navigation shows Shortlisted. “Both roles read the same authoritative record.”                                                                                                                                      |
| 11   | Career Development         | Show real required/preferred gaps, affected jobs, occupation ideas and Excel Fundamentals when Microsoft Excel is actually missing. “These internal practice guides support development; they are not accredited training.” |

Optional second applicant: confirm Reject Application and show **Not Selected** to the seeker. Do not expose internal personal notes. For a withdrawn application, show historical status and absence of recruitment actions.

## Trust boundary / employer publishing segment

If time permits, show the Admin queue at `/admin/verifications`, inspect sanitized documents and approve the demo employer. A pending employer can save drafts but cannot publish. Then publish a prepared draft and show that it enters recommendations.

At the end, close the demo job and refresh Home/recommendations. The vacancy and its affected gaps disappear; existing applications remain available to the employer. Do this only after the Apply segment. A closed job cannot be reopened through the current lifecycle API.

## AI explanation in 30 seconds

“MiniLM is a pretrained multilingual Sentence Transformer running locally on CPU. It converts profile and job text into 384-dimensional vectors. Cosine similarity contributes 45% of the result; skills 25%, location 15%, education 10% and experience 5%. We show matched and missing skills so the user can interpret the recommendation. Career ideas use a separate occupation comparison, not a hiring probability.”

Optional technical proof: the provided phrase test scores related customer-service/social-media text about 0.6095 and unrelated backend engineering about 0.1904. This illustrates semantic behavior, not overall model accuracy.

## Honest fallback path

If FastAPI is unavailable or a request times out:

1. Keep the application running. Refresh the vacancy view.
2. Show/log **`text_overlap_fallback`** and say: “The local semantic service is temporarily unavailable. The app uses its existing text-overlap fallback so discovery and application can continue.”
3. Do not call that score a transformer result. Career cards separately label **`skills_overlap_fallback`**.
4. Resume parsing needs the Python service; if unavailable, continue with the already reviewed manual profile. Show the preservation message instead of claiming that parsing succeeded.
5. Once the service is healthy, refresh and verify the primary engine returns. No model reinstall or project relocation is needed.

If email is not configured, use a private development preview before screen-sharing, explaining that it is not actual inbox delivery. A configured provider failure does not automatically generate a preview. If MySQL/app services fail, resolve them before continuing; there is no fabricated application-state fallback.

## Do not claim during the pitch

- Guaranteed employment, a hiring probability, automated rejection or a model trained from scratch.
- Accredited courses/certifications/TESDA integration for internal practice guides.
- Government partnership, production compliance, measured unemployment reduction or labor analytics without evidence.
- Interview scheduling, offers, hiring, workplace-readiness scoring or AI interview practice as implemented features.

End with the actual result: a transparent recruitment loop plus practical Job Seeker career-development tools, with human control over profile review and employer decisions.
