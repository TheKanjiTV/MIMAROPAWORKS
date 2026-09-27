# TASKS — Execution Plan

> **Purpose:** The singular source of truth for execution sequencing and progress tracking. AI agents must execute exactly one numbered task at a time as directed by the user. Tier-3 template — the agent will fill this in based on the PRD MVP.

_Last updated: September 12, 2026_

---

## 1. Setup

- [x] 1.1 Project scaffold + folder structure
- [x] 1.2 Theme, colors, typography (from DESIGN.md)
- [x] 1.3 Routing skeleton
- [x] 1.4 Lint rules + CI (ESLint, Prettier, Vitest)

## 2. Data layer

- [x] 2.1 Define models (see `src/types/` - User, Job, Application, MatchingScore)
- [x] 2.2 Local storage setup (React Query devtools for mock data)
- [x] 2.3 Repository + interface (Prisma ORM with repository pattern)
- [x] 2.4 Seed / mock data for development (sample users, jobs, skills)

## 3. User Management & Authentication

- [x] 3.1 User registration (job seeker and employer)
- [x] 3.2 User login/logout with JWT
- [x] 3.3 Profile retrieval and update
- [x] 3.4 Password reset functionality
- [x] 3.5 Email verification flow

## 4. Profile Management

- [x] 4.1 Skills management (add/update/remove)
- [x] 4.2 Education management (add/update/remove)
- [x] 4.3 Experience management (add/update/remove)
- [x] 4.4 Profile completion tracking
- [x] 4.5 Profile visibility controls

## 5. Job Vacancy Management

- [x] 5.1 Job creation (employer only)
- [x] 5.2 Job listing with filtering/search
- [x] 5.3 Job detail view
- [x] 5.4 Job updating (employer only, own jobs)
- [x] 5.5 Job deactivation (employer only, own jobs)
- [x] 5.6 Required skills management for jobs

## 6. AI Matching Engine

- [x] 6.1 Skills matching algorithm (TF-IDF/cosine similarity)
- [x] 6.2 Experience matching algorithm
- [x] 6.3 Education matching algorithm
- [x] 6.4 Location proximity matching
- [x] 6.5 Overall score calculation (weighted average)
- [x] 6.6 Explainability factors generation
- [x] 6.7 Matching score caching (Redis)
- [x] 6.8 Batch processing for pre-computation

## 7. Job Recommendations

- [x] 7.1 Personalized job feed for seekers
- [x] 7.2 Matching score display with breakdown
- [x] 7.3 Job filtering by match threshold
- [x] 7.4 Save/dismiss job recommendations
- [x] 7.5 Application flow from recommendations

## 8. Application Management

- [x] 8.1 Job application submission
- [x] 8.2 Application status tracking
- [x] 8.3 Employer view of applicants (ranked by match score)
- [x] 8.4 Application status updates (employer)
- [x] 8.5 Application withdrawal (seeker)

## 9. Admin Dashboard

- [x] 9.1 Organization verification queue
- [x] 9.2 Basic vacancy management overview
- [x] 9.3 User statistics (active seekers/employers)
- [x] 9.4 Matching success rate metrics
- [x] 9.5 Basic analytics data export

## 10. Polish & Quality

- [ ] 10.1 Loading states optimization
- [ ] 10.2 Error states handling
- [ ] 10.3 Accessibility audit (WCAG 2.2 AA)
- [ ] 10.4 Performance optimization (bundle size, API latency)
- [ ] 10.5 Security review (OWASP Top 10)
- [ ] 10.6 Documentation completion
- [ ] 10.7 Beta testing preparation

---

## Blocked

- [!] 10.2 Advanced analytics dashboard — waiting on Phase 2 funding approval
- [!] 10.5 Skills gap analysis with learning recommendations — waiting on content partner agreements
- [!] 10.7 Mobile app development — waiting on UX design completion

## Parked

Things deliberately deferred. Not forgotten, not being built.

- [ ] Video profile introductions — revisit after v1
- [ ] Resume builder tool — revisit after v1
- [ ] Employer branding enhancements — revisit after v1
- [ ] Multi-language support (Tagalog, Cebuano) — revisit after v1
- [ ] Integration with external job boards — revisit after v1