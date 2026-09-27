# Local demo employers

The local seeder adds **300 fictional employer accounts, 300 company profiles, and 300 active jobs**. There are 60 companies in each MIMAROPA province, 12 sectors, and 60 role titles with matching skills, salary ranges, work arrangements, and locations. Each company has a distinct fictional recruitment representative and exactly one seeded vacancy.

Existing accounts, including Angela Mae Villanueva's company, are preserved. This is additional data; it does not create a job for or change an existing employer.

From the project directory in PowerShell, inspect first:

```powershell
node server/seed-demo-employers.mjs --dry-run
```

Create the local demo records:

```powershell
node server/seed-demo-employers.mjs --apply
```

The script reads `.env`, requires an already migrated database, refuses `NODE_ENV=production`, and accepts only loopback MySQL hosts or local SQLite paths. It sends no email and creates no verification documents. Every company description and vacancy identifies the fictional data. The `verified` state enables the local publishing demonstration; its verification reason explicitly says that no business documents were submitted or reviewed.

Employer emails run from `employer001@demo.mimaropa.test` through `employer300@demo.mimaropa.test`. Each has a unique generated 32-character password, stored only in **`server/data/demo-employers-credentials.csv`**, which is already ignored by Git. Open that file locally to choose an account and use the normal sign-in page. Do not commit or share the credentials file. Database passwords use Argon2id; the script never prints account passwords.

The account role, selected role, email flag, and profile completion are configured so these local accounts can use the employer dashboard immediately. The reserved email domain and placeholder telephone are not working contact channels; these vacancies are for testing, not real applications or outreach.

Rerunning is safe: stable IDs and a full preflight identify existing seed records, reuse the original credentials file, and insert only missing complete sets. All inserts use one database transaction. Existing profile changes, passwords, verification decisions, and job statuses are never reset. If a demo employer later creates extra jobs, the summary reports them separately from the 300 seed-owned jobs. Restoring a closed job to active remains an explicit employer action.

Keep the credentials file when rerunning. If existing seed records are incomplete or collide with another identity, the script stops instead of overwriting data. A credentials file can remain after a failed transaction; reuse it on the next run. Dry-run performs database reads only and does not create credentials or run migrations.
