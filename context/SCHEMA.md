# SCHEMA — Database & API Schema

> **Purpose:** Document the database structure, table definitions, relationships, security policies, and API contracts so developers and AI agents query and manipulate data safely without guessing schema details. Tier-3 template — fill it in for your project.

_Last updated: September 12, 2026_

---

## 1. Data Layer Overview

MIMAWorks AI uses a relational database (PostgreSQL) for persistent storage with Redis for caching frequently accessed data and computed matching scores.

- **Primary Database:** PostgreSQL 15+ for relational data storage
- **Cache Datastore:** Redis 7+ for session storage, caching user profiles, job listings, and computed matching scores
- **Object Storage:** AWS S3 for storing user-uploaded documents (resumes, certificates) and company logos

---

## 2. Database Tables & ER Diagram

The database schema consists of several interconnected tables representing users, job vacancies, applications, and matching results.

```mermaid
erDiagram
    USERS ||..|> USER_PROFILES : has
    USERS ||..o{ JOB_VACANCIES : posts
    USERS ||..o{ APPLICATIONS : submits
    JOB_VACANCIES ||..o{ APPLICATIONS : receives
    COMPANIES ||..o{ JOB_VACANCIES : lists
    USER_PROFILES ||..o{ SKILLS : possesses
    USER_PROFILES ||..o{ EDUCATION : completed
    USER_PROFILES ||..o{ EXPERIENCE : has
    JOB_VACANCIES ||..o{ REQUIRED_SKILLS : requires
    MATCHING_SCORES }|..|| USER_PROFILES : for_seeker
    MATCHING_SCORES }|..|| JOB_VACANCIES : for_vacancy
    
    USERS {
        uuid id PK
        string email
        string password_hash
        enum role
        boolean is_verified
        timestamp created_at
        timestamp updated_at
    }
    USER_PROFILES {
        uuid id PK
        uuid user_id FK
        string first_name
        string last_name
        string phone
        string location
        boolean is_complete
        timestamp created_at
        timestamp updated_at
    }
    COMPANIES {
        uuid id PK
        string name
        string description
        string website
        string industry
        string location
        boolean is_verified
        timestamp created_at
        timestamp updated_at
    }
    JOB_VACANCIES {
        uuid id PK
        uuid company_id FK
        uuid posted_by_user_id FK
        string title
        string description
        string location
        enum employment_type
        enum experience_level
        decimal salary_min
        decimal salary_max
        boolean is_remote
        boolean is_active
        timestamp created_at
        timestamp updated_at
        timestamp expires_at
    }
    REQUIRED_SKILLS {
        uuid id PK
        uuid job_vacancy_id FK
        string skill_name
        enum proficiency_level
        boolean is_required
    }
    SKILLS {
        uuid id PK
        uuid user_profile_id FK
        string skill_name
        enum proficiency_level
        integer years_experience
    }
    EDUCATION {
        uuid id PK
        uuid user_profile_id FK
        string institution
        string degree
        string field_of_study
        integer graduation_year
        string gpa
    }
    EXPERIENCE {
        uuid id PK
        uuid user_profile_id FK
        string company_name
        string position
        string location
        date start_date
        date end_date
        boolean is_current
        string description
    }
    APPLICATIONS {
        uuid id PK
        uuid user_id FK
        uuid job_vacancy_id FK
        enum status
        timestamp applied_at
        timestamp updated_at
    }
    MATCHING_SCORES {
        uuid id PK
        uuid user_profile_id FK
        uuid job_vacancy_id FK
        decimal overall_score
        decimal skills_match
        decimal experience_match
        decimal education_match
        decimal location_match
        jsonb explanation_factors
        timestamp calculated_at
    }
```

---

## 3. Table Schemas & Column Definitions

### Table: `users`
Core user authentication and account information.

| Column Name | Data Type | Nullable | Default | Constraints / Index | Description |
| :---------- | :-------- | :------- | :------ | :------------------ | :---------- |
| `id` | `UUID` | No | `gen_random_uuid()` | Primary Key | Unique user identifier |
| `email` | `VARCHAR(255)` | No | None | Unique Index, Not Null | User login email |
| `password_hash` | `VARCHAR(255)` | No | None | Not Null | bcrypt hashed password |
| `role` | `VARCHAR(20)` | No | `'job_seeker'` | Check (`job_seeker`, `employer`, `admin`) | User authorization role |
| `is_verified` | `BOOLEAN` | No | `FALSE` | Not Null | Email verification status |
| `created_at` | `TIMESTAMPTZ` | No | `NOW()` | Not Null | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `NOW()` | Not Null | Last update timestamp |

### Table: `user_profiles`
Extended profile information for users (separated for privacy and extensibility).

| Column Name | Data Type | Nullable | Default | Constraints / Index | Description |
| :---------- | :-------- | :------- | :------ | :------------------ | :---------- |
| `id` | `UUID` | No | `gen_random_uuid()` | Primary Key | Unique profile identifier |
| `user_id` | `UUID` | No | None | Foreign Key (`users.id`), Not Null, Unique | Reference to user |
| `first_name` | `VARCHAR(100)` | No | None | Not Null | User's first name |
| `last_name` | `VARCHAR(100)` | No | None | Not Null | User's last name |
| `phone` | `VARCHAR(20)` | Yes | None | | Contact phone number |
| `location` | `VARCHAR(255)` | Yes | None | | Current city/province |
| `is_complete` | `BOOLEAN` | No | `FALSE` | Not Null | Profile completion status |
| `created_at` | `TIMESTAMPTZ` | No | `NOW()` | Not Null | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `NOW()` | Not Null | Last update timestamp |

### Table: `companies`
Information about employers/organizations posting job vacancies.

| Column Name | Data Type | Nullable | Default | Constraints / Index | Description |
| :---------- | :-------- | :------- | :------ | :------------------ | :---------- |
| `id` | `UUID` | No | `gen_random_uuid()` | Primary Key | Unique company identifier |
| `name` | `VARCHAR(255)` | No | None | Not Null | Company name |
| `description` | `TEXT` | Yes | None | | Company description |
| `website` | `VARCHAR(255)` | Yes | None | | Company website URL |
| `industry` | `VARCHAR(100)` | Yes | None | | Industry sector |
| `location` | `VARCHAR(255)` | Yes | None | | Company headquarters location |
| `is_verified` | `BOOLEAN` | No | `FALSE` | Not Null | Verified employer status |
| `created_at` | `TIMESTAMPTZ` | No | `NOW()` | Not Null | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `NOW()` | Not Null | Last update timestamp |

### Table: `job_vacancies`
Job openings posted by employers.

| Column Name | Data Type | Nullable | Default | Constraints / Index | Description |
| :---------- | :-------- | :------- | :------ | :------------------ | :---------- |
| `id` | `UUID` | No | `gen_random_uuid()` | Primary Key | Unique job vacancy identifier |
| `company_id` | `UUID` | No | None | Foreign Key (`companies.id`), Not Null | Reference to posting company |
| `posted_by_user_id` | `UUID` | No | None | Foreign Key (`users.id`), Not Null | Reference to user who posted |
| `title` | `VARCHAR(255)` | No | None | Not Null, Index | Job title |
| `description` | `TEXT` | No | None | Not Null | Detailed job description |
| `location` | `VARCHAR(255)` | Yes | None | | Job location (can be remote) |
| `employment_type` | `VARCHAR(20)` | No | `'full_time'` | Check (`full_time`, `part_time`, `contract`, `internship`, `temporary`) | Type of employment |
| `experience_level` | `VARCHAR(20)` | No | `'mid_level'` | Check (`entry_level`, `mid_level`, `senior_level`, `executive`) | Required experience level |
| `salary_min` | `DECIMAL(10,2)` | Yes | None | | Minimum annual salary (PHP) |
| `salary_max` | `DECIMAL(10,2)` | Yes | None | | Maximum annual salary (PHP) |
| `is_remote` | `BOOLEAN` | No | `FALSE` | Not Null | Whether job is remote |
| `is_active` | `BOOLEAN` | No | `TRUE` | Not Null | Whether job is currently active |
| `created_at` | `TIMESTAMPTZ` | No | `NOW()` | Not Null | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `NOW()` | Not Null | Last update timestamp |
| `expires_at` | `TIMESTAMPTZ` | Yes | None | | When job posting expires |

### Table: `required_skills`
Skills required for specific job vacancies.

| Column Name | Data Type | Nullable | Default | Constraints / Index | Description |
| :---------- | :-------- | :------- | :------ | :------------------ | :---------- |
| `id` | `UUID` | No | `gen_random_uuid()` | Primary Key | Unique requirement identifier |
| `job_vacancy_id` | `UUID` | No | None | Foreign Key (`job_vacancies.id`), Not Null, On Delete Cascade | Reference to job vacancy |
| `skill_name` | `VARCHAR(100)` | No | None | Not Null, Index | Name of required skill |
| `proficiency_level` | `VARCHAR(20)` | No | `'familiar'` | Check (`none`, `familiar`, `proficient`, `expert`) | Required proficiency level |
| `is_required` | `BOOLEAN` | No | `TRUE` | Not Null | Whether skill is mandatory or preferred |

### Table: `skills`
Skills possessed by users (from their profiles).

| Column Name | Data Type | Nullable | Default | Constraints / Index | Description |
| :---------- | :-------- | :------- | :------ | :------------------ | :---------- |
| `id` | `UUID` | No | `gen_random_uuid()` | Primary Key | Unique skill identifier |
| `user_profile_id` | `UUID` | No | None | Foreign Key (`user_profiles.id`), Not Null, On Delete Cascade | Reference to user profile |
| `skill_name` | `VARCHAR(100)` | No | None | Not Null, Index | Name of skill |
| `proficiency_level` | `VARCHAR(20)` | No | `'familiar'` | Check (`none`, `familiar`, `proficient`, `expert`) | Self-assessed proficiency |
| `years_experience` | `INTEGER` | Yes | None | Check (`years_experience >= 0`) | Years of experience with skill |

### Table: `education`
Educational background of users.

| Column Name | Data Type | Nullable | Default | Constraints / Index | Description |
| :---------- | :-------- | :------- | :------ | :------------------ | :---------- |
| `id` | `UUID` | No | `gen_random_uuid()` | Primary Key | Unique education record identifier |
| `user_profile_id` | `UUID` | No | None | Foreign Key (`user_profiles.id`), Not Null, On Delete Cascade | Reference to user profile |
| `institution` | `VARCHAR(255)` | No | None | Not Null | Educational institution name |
| `degree` | `VARCHAR(100)` | Yes | None | | Degree earned (BS, MS, PhD, etc.) |
| `field_of_study` | `VARCHAR(255)` | Yes | None | | Major or specialization |
| `graduation_year` | `INTEGER` | Yes | None | Check (`graduation_year BETWEEN 1900 AND 2100`) | Year of graduation |
| `gpa` | `DECIMAL(3,2)` | Yes | None | Check (`gpa BETWEEN 0.00 AND 4.00`) | Grade point average |

### Table: `experience`
Work history of users.

| Column Name | Data Type | Nullable | Default | Constraints / Index | Description |
| :---------- | :-------- | :------- | :------ | :------------------ | :---------- |
| `id` | `UUID` | No | `gen_random_uuid()` | Primary Key | Unique experience record identifier |
| `user_profile_id` | `UUID` | No | None | Foreign Key (`user_profiles.id`), Not Null, On Delete Cascade | Reference to user profile |
| `company_name` | `VARCHAR(255)` | No | None | Not Null | Employer company name |
| `position` | `VARCHAR(255)` | No | None | Not Null | Job title/position held |
| `location` | `VARCHAR(255)` | Yes | None | | Job location |
| `start_date` | `DATE` | No | None | Not Null | Start date of employment |
| `end_date` | `DATE` | Yes | None | | End date of employment (null if current) |
| `is_current` | `BOOLEAN` | No | `FALSE` | Not Null | Whether this is current position |
| `description` | `TEXT` | Yes | None | | Description of responsibilities and achievements |

### Table: `applications`
Job applications submitted by users.

| Column Name | Data Type | Nullable | Default | Constraints / Index | Description |
| :---------- | :-------- | :------- | :------ | :------------------ | :---------- |
| `id` | `UUID` | No | `gen_random_uuid()` | Primary Key | Unique application identifier |
| `user_id` | `UUID` | No | None | Foreign Key (`users.id`), Not Null | Reference to applicant |
| `job_vacancy_id` | `UUID` | No | None | Foreign Key (`job_vacancies.id`), Not Null, On Delete Cascade | Reference to job applied for |
| `status` | `VARCHAR(20)` | No | `'applied'` | Check (`applied`, `under_review`, `interviewing`, `offered`, `hired`, `rejected`, `withdrawn`) | Application status |
| `applied_at` | `TIMESTAMPTZ` | No | `NOW()` | Not Null | When application was submitted |
| `updated_at` | `TIMESTAMPTZ` | No | `NOW()` | Not Null | Last status update timestamp |

### Table: `matching_scores`
Pre-computed matching scores between user profiles and job vacancies.

| Column Name | Data Type | Nullable | Default | Constraints / Index | Description |
| :---------- | :-------- | :------- | :------ | :------------------ | :---------- |
| `id` | `UUID` | No | `gen_random_uuid()` | Primary Key | Unique matching score identifier |
| `user_profile_id` | `UUID` | No | None | Foreign Key (`user_profiles.id`), Not Null | Reference to job seeker profile |
| `job_vacancy_id` | `UUID` | No | None | Foreign Key (`job_vacancies.id`), Not Null | Reference to job vacancy |
| `overall_score` | `DECIMAL(5,2)` | No | None | Check (`overall_score BETWEEN 0.00 AND 100.00`), Index | Overall match percentage (0-100) |
| `skills_match` | `DECIMAL(5,2)` | No | None | Check (`skills_match BETWEEN 0.00 AND 100.00`) | Skills compatibility score |
| `experience_match` | `DECIMAL(5,2)` | No | None | Check (`experience_match BETWEEN 0.00 AND 100.00`) | Experience compatibility score |
| `education_match` | `DECIMAL(5,2)` | No | None | Check (`education_match BETWEEN 0.00 AND 100.00`) | Education compatibility score |
| `location_match` | `DECIMAL(5,2)` | No | None | Check (`location_match BETWEEN 0.00 AND 100.00`) | Location compatibility score |
| `explanation_factors` | `JSONB` | Yes | None | | Breakdown of factors contributing to score |
| `calculated_at` | `TIMESTAMPTZ` | No | `NOW()` | Not Null, Index | When score was last calculated |
| 
| | | | | Unique Index (`user_profile_id`, `job_vacancy_id`) | Prevent duplicate scores |

---

## 4. Row-Level Security (RLS) & Access Policies

Row-level security policies ensure users can only access data they're authorized to see.

- **Table `users`:**
  - `SELECT`: Users can see their own data; admins can see all users
  - `UPDATE`: Users can update their own data; admins can update any user
  - `INSERT`: Only allowed during registration (handled by auth service)
  - `DELETE`: Only admins can delete users (soft delete preferred)

- **Table `user_profiles`:**
  - `SELECT`: Users can see their own profile; employers can see limited profile info of applicants to their jobs
  - `UPDATE`: Users can update their own profile
  - `INSERT`: Users can create their own profile
  - `DELETE`: Users can delete their own profile (with cascading cleanup)

- **Table `companies`:**
  - `SELECT`: Public can see basic company info; verified employers see full details
  - `UPDATE`: Verified employers can update their own company info
  - `INSERT`: Employers can create company profiles (pending verification)
  - `DELETE`: Only admins can delete company profiles

- **Table `job_vacancies`:**
  - `SELECT`: Public can see active jobs; employers see their own jobs (active and inactive)
  - `UPDATE`: Employers can update their own job vacancies
  - `INSERT`: Employers can create job vacancies for their companies
  - `DELETE`: Employers can delete their own job vacancies

- **Table `required_skills`:**
  - `SELECT`: Visible alongside job vacancies
  - `UPDATE`: Employers can update required skills for their own jobs
  - `INSERT`: Employers can add required skills to their own jobs
  - `DELETE`: Employers can remove required skills from their own jobs

- **Table `skills`, `education`, `experience`:**
  - `SELECT`: Users can see their own records; matching service can read for score calculation
  - `UPDATE`: Users can update their own records
  - `INSERT`: Users can add their own records
  - `DELETE`: Users can delete their own records

- **Table `applications`:**
  - `SELECT`: Users can see their own applications; employers can see applications to their jobs
  - `UPDATE`: Users can withdraw their own applications; employers can update application status
  - `INSERT`: Users can submit applications to jobs
  - `DELETE`: Users can delete their own applications (before review); employers cannot delete

- **Table `matching_scores`:**
  - `SELECT`: Matching service can read/write; users can see their own scores for jobs
  - `UPDATE`: Matching service updates scores; no direct user updates
  - `INSERT`: Matching service creates new scores
  - `DELETE`: Matching service removes stale scores

---

## 5. API Routes by Domain

REST API endpoints organized by functional domain.

### Domain: Auth & Users

- `POST /api/v1/auth/register` — Register new user account (job seeker or employer)
- `POST /api/v1/auth/login` — Authenticate and return access/refresh tokens
- `POST /api/v1/auth/logout` — Invalidate refresh token
- `POST /api/v1/auth/refresh` — Refresh access token using refresh token
- `GET /api/v1/users/me` — Retrieve current authenticated user profile
- `PUT /api/v1/users/me` — Update current user profile
- `GET /api/v1/users/:id` — Retrieve user profile by ID (limited info based on permissions)

### Domain: Profiles & Skills

- `GET /api/v1/profiles/me` — Get current user's complete profile
- `PUT /api/v1/profiles/me` — Update current user's complete profile
- `GET /api/v1/profiles/:id` — Get user profile by ID (permissions apply)
- `POST /api/v1/profiles/:id/skills` — Add skill to profile
- `PUT /api/v1/profiles/:id/skills/:skillId` — Update skill proficiency
- `DELETE /api/v1/profiles/:id/skills/:skillId` — Remove skill from profile
- `POST /api/v1/profiles/:id/education` — Add education entry
- `PUT /api/v1/profiles/:id/education/:eduId` — Update education entry
- `DELETE /api/v1/profiles/:id/education/:eduId` — Remove education entry
- `POST /api/v1/profiles/:id/experience` — Add experience entry
- `PUT /api/v1/profiles/:id/experience/:expId` — Update experience entry
- `DELETE /api/v1/profiles/:id/experience/:expId` — Remove experience entry

### Domain: Companies & Jobs

- `GET /api/v1/companies` — List companies (with filtering, pagination)
- `POST /api/v1/companies` — Create company profile (employer only)
- `GET /api/v1/companies/:id` — Get company details
- `PUT /api/v1/companies/:id` — Update company profile (owner only)
- `GET /api/v1/companies/:id/jobs` — List jobs posted by company
- `GET /api/v1/jobs` — List job vacancies (with filtering, search, pagination)
- `POST /api/v1/jobs` — Create new job vacancy (employer only)
- `GET /api/v1/jobs/:id` — Get job vacancy details
- `PUT /api/v1/jobs/:id` — Update job vacancy (employer only)
- `DELETE /api/v1/jobs/:id` — Deactivate job vacancy (employer only)
- `POST /api/v1/jobs/:id/skills` — Add required skill to job
- `PUT /api/v1/jobs/:id/skills/:skillId` — Update required skill
- `DELETE /api/v1/jobs/:id/skills/:skillId` — Remove required skill from job

### Domain: Applications & Matching

- `GET /api/v1/applications` — List user's applications (with filtering)
- `POST /api/v1/applications` — Submit job application
- `GET /api/v1/applications/:id` — Get application details
- `PUT /api/v1/applications/:id` — Update application status (employer only)
- `GET /api/v1/matching/recommendations` — Get job recommendations for user
- `GET /api/v1/matching/score/:jobId` — Get matching score for specific job
- `GET /api/v1/matching/applicants/:jobId` — Get ranked applicants for job (employer only)
- `GET /api/v1/matching/skill-gaps/:jobId` — Get skill gap analysis for user vs job

### Domain: Analytics & Reporting

- `GET /api/v1/analytics/dashboard` — Get admin dashboard metrics
- `GET /api/v1/analytics/trends` — Get employment trends over time
- `GET /api/v1/analytics/skills-demand` — Get most in-demand skills
- `GET /api/v1/analytics/salary-benchmarks` — Get salary data by role/location
- `GET /api/v1/analytics/geographic` — Get geographic distribution of jobs/talent

---

## 6. Request & Response Payload Examples

### Request: `POST /api/v1/auth/register`
```json
{
  "email": "juan.dela.cruz@example.com",
  "password": "securePassword123!",
  "role": "job_seeker",
  "firstName": "Juan",
  "lastName": "Dela Cruz",
  "phone": "+639171234567",
  "location": "Calapan City, Oriental Mindoro"
}
```

### Success Response: `201 Created`
```json
{
  "success": true,
  "data": {
    "userId": "123e4567-e89b-12d3-a456-426614174000",
    "email": "juan.dela.cruz@example.com",
    "role": "job_seeker",
    "firstName": "Juan",
    "lastName": "Dela Cruz",
    "phone": "+639171234567",
    "location": "Calapan City, Oriental Mindoro",
    "isVerified": false,
    "createdAt": "2026-09-12T08:30:00Z"
  }
}
```

### Request: `POST /api/v1/jobs`
```json
{
  "companyId": "a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8",
  "title": "Senior Software Engineer",
  "description": "We are looking for a Senior Software Engineer to join our team...",
  "location": "Puerto Princesa City, Palawan",
  "employmentType": "full_time",
  "experienceLevel": "senior_level",
  "salaryMin": 600000,
  "salaryMax": 900000,
  "isRemote": false
}
```

### Success Response: `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "b2c3d4e5-f6g7-8901-h2i3-j4k5l6m7n8o9",
    "companyId": "a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8",
    "title": "Senior Software Engineer",
    "location": "Puerto Princesa City, Palawan",
    "employmentType": "full_time",
    "experienceLevel": "senior_level",
    "salaryMin": 600000,
    "salaryMax": 900000,
    "isRemote": false,
    "isActive": true,
    "createdAt": "2026-09-12T09:15:00Z",
    "expiresAt": "2026-12-12T09:15:00Z"
  }
}
```

### Request: `GET /api/v1/matching/recommendations` (for authenticated user)
### Success Response: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "jobId": "b2c3d4e5-f6g7-8901-h2i3-j4k5l6m7n8o9",
      "title": "Senior Software Engineer",
      "company": {
        "id": "a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8",
        "name": "TechSolutions Philippines",
        "industry": "Information Technology"
      },
      "location": "Puerto Princesa City, Palawan",
      "employmentType": "full_time",
      "experienceLevel": "senior_level",
      "salaryRange": "PHP 600,000 - 900,000",
      "isRemote": false,
      "matchingScore": {
        "overallScore": 87.5,
        "skillsMatch": 92.0,
        "experienceMatch": 85.0,
        "educationMatch": 80.0,
        "locationMatch": 95.0,
        "explanationFactors": {
          "skills": {
            "matched": ["JavaScript", "Node.js", "React", "PostgreSQL"],
            "missing": ["TypeScript", "AWS"],
            "score": 92.0
          },
          "experience": {
            "yearsRequired": 5,
            "yearsApplicant": 7,
            "score": 85.0
          },
          "education": {
            "required": "Bachelor's in Computer Science",
            "applicant": "Bachelor's in Information Technology",
            "score": 80.0
          },
          "location": {
            "distanceKm": 15,
            "withinPreferredRadius": true,
            "score": 95.0
          }
        }
      },
      "postedAt": "2026-09-12T09:15:00Z",
      "expiresAt": "2026-12-12T09:15:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 24,
    "pages": 3
  }
}
```

### Error Response: `400 Bad Request` (Validation)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input validation failed",
    "details": [
      { "field": "email", "issue": "Must be a valid email address" },
      { "field": "password", "issue": "Password must be at least 8 characters long" }
    ]
  }
}
```

### Error Response: `401 Unauthorized`
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required",
    "details": null
  }
}
```

### Error Response: `403 Forbidden`
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions to perform this action",
    "details": null
  }
}
```

### Error Response: `404 Not Found`
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource could not be found",
    "details": null
  }
}
```

---

## 7. Phase-Based Route Priority

Implementation priority across delivery phases.

### Phase 1 (MVP - Core Matching Functionality)
- **Auth:** `/auth/register`, `/auth/login`, `/auth/logout`, `/users/me`
- **Profiles:** `/profiles/me` (GET/PUT), `/profiles/:id/skills` (POST/PUT/DELETE)
- **Jobs:** `/jobs` (GET), `/jobs/:id` (GET), `/jobs` (POST - employer only)
- **Applications:** `/applications` (POST), `/applications/me` (GET)
- **Matching:** `/matching/recommendations` (GET), `/matching/score/:jobId` (GET)

### Phase 2 (Enhancement - Employer & Admin Features)
- **Companies:** `/companies` (GET/POST), `/companies/:id` (GET/PUT)
- **Jobs:** `/jobs/:id` (PUT/DELETE - employer only), `/jobs/:id/skills` (POST/PUT/DELETE)
- **Applications:** `/applications/:id` (GET/PUT - employer for status updates)
- **Matching:** `/matching/applicants/:jobId` (GET - employer), `/matching/skill-gaps/:jobId` (GET)
- **Profiles:** Full education/experience CRUD (`/profiles/:id/education`, `/profiles/:id/experience`)

### Phase 3 (Scale - Analytics & Advanced Features)
- **Analytics:** All `/analytics/*` endpoints
- **Advanced Matching:** Batch processing, real-time updates, AI explainability improvements
- **Admin:** User management, company verification, system settings
- **Notifications:** Email/SMS alerts for new matches, application updates