import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import argon2 from 'argon2';
import { connectDatabase, databaseConfig } from './database.mjs';

export const DEMO_COUNT = 300;
export const DEMO_CREDENTIALS_PATH = fileURLToPath(new URL('./data/demo-employers-credentials.csv', import.meta.url));
const DEMO_REASON = 'LOCAL DEMO SEED: Fictional company. Verification is enabled only to demonstrate publishing; no business documents were submitted or reviewed.';
const regions = [
  ['Oriental Mindoro', 'Mindoro East', ['Calapan City', 'Naujan', 'Pinamalayan', 'Roxas', 'Puerto Galera']],
  ['Occidental Mindoro', 'Mindoro West', ['San Jose', 'Mamburao', 'Sablayan', 'Abra de Ilog', 'Paluan']],
  ['Marinduque', 'Marinduque', ['Boac', 'Mogpog', 'Gasan', 'Santa Cruz', 'Buenavista']],
  ['Romblon', 'Romblon', ['Odiongan', 'Romblon', 'San Agustin', 'Cajidiocan', 'San Fernando']],
  ['Palawan', 'Palawan', ['Puerto Princesa City', 'El Nido', 'Coron', 'Roxas', 'Brooke\'s Point']],
];
// Five roles per sector, distributed across each of the five provinces.
const sectors = [
  { industry: 'Information Technology', company: 'Digital Studio', service: 'web development and technical support', preferred: ['Git', 'Documentation'], roles: [
    ['Junior Web Developer', 23000, 33000, ['HTML', 'CSS', 'JavaScript'], "Bachelor's Degree", 'Hybrid'],
    ['IT Support Specialist', 19000, 28000, ['Troubleshooting', 'Computer Hardware', 'Customer Service'], 'Vocational / TESDA', 'On-site'],
    ['QA Tester', 21000, 31000, ['Software Testing', 'Attention to Detail', 'Communication'], "Bachelor's Degree", 'Remote'],
    ['Frontend Developer', 30000, 45000, ['React', 'TypeScript', 'CSS'], "Bachelor's Degree", 'Remote'],
    ['Network Support Technician', 22000, 32000, ['Networking', 'Troubleshooting', 'Computer Hardware'], 'Vocational / TESDA', 'On-site'],
  ] },
  { industry: 'Business Process Outsourcing', company: 'Customer Care Services', service: 'customer support and back-office operations', preferred: ['CRM', 'Microsoft Office'], roles: [
    ['Customer Service Representative', 17000, 25000, ['Customer Service', 'Communication', 'Problem Solving'], 'Senior High School', 'On-site'],
    ['Chat Support Associate', 19000, 27000, ['Written Communication', 'Typing', 'Customer Service'], 'Senior High School', 'Remote'],
    ['Data Entry Specialist', 17000, 23000, ['Microsoft Excel', 'Data Entry', 'Attention to Detail'], 'Senior High School', 'Hybrid'],
    ['Technical Support Representative', 23000, 33000, ['Troubleshooting', 'Customer Service', 'Communication'], 'College Undergraduate', 'Hybrid'],
    ['Quality Assurance Associate', 25000, 35000, ['Quality Assurance', 'Microsoft Excel', 'Communication'], "Bachelor's Degree", 'On-site'],
  ] },
  { industry: 'Marketing / Digital Services', company: 'Creative Agency', service: 'digital marketing and creative production', preferred: ['Copywriting', 'Microsoft Excel'], roles: [
    ['Marketing Assistant', 17000, 24000, ['Canva', 'Social Media Management', 'Communication'], 'College Undergraduate', 'Hybrid'],
    ['Social Media Coordinator', 21000, 30000, ['Social Media Management', 'Content Writing', 'Canva'], "Bachelor's Degree", 'Remote'],
    ['Graphic Designer', 23000, 35000, ['Graphic Design', 'Adobe Photoshop', 'Canva'], 'Vocational / TESDA', 'Hybrid'],
    ['Content Writer', 21000, 31000, ['Content Writing', 'SEO', 'Research'], "Bachelor's Degree", 'Remote'],
    ['Digital Marketing Specialist', 28000, 42000, ['Digital Marketing', 'SEO', 'Analytics'], "Bachelor's Degree", 'Hybrid'],
  ] },
  { industry: 'Tourism / Travel', company: 'Island Travel Services', service: 'local tours and visitor reservations', preferred: ['First Aid', 'Social Media Management'], roles: [
    ['Travel Reservations Assistant', 17000, 24000, ['Customer Service', 'Reservation Management', 'Communication'], 'Senior High School', 'On-site'],
    ['Tour Coordinator', 19000, 28000, ['Tour Coordination', 'Communication', 'Local Knowledge'], 'Vocational / TESDA', 'On-site'],
    ['Guest Experience Associate', 18000, 26000, ['Customer Service', 'Problem Solving', 'Communication'], 'College Undergraduate', 'On-site'],
    ['Travel Operations Assistant', 20000, 29000, ['Scheduling', 'Microsoft Excel', 'Organization'], "Bachelor's Degree", 'On-site'],
    ['Tourism Marketing Officer', 25000, 35000, ['Digital Marketing', 'Content Writing', 'Communication'], "Bachelor's Degree", 'Hybrid'],
  ] },
  { industry: 'Hospitality / Food Services', company: 'Hospitality Group', service: 'guest accommodation and food service', preferred: ['Customer Service', 'Teamwork'], roles: [
    ['Front Desk Associate', 16000, 23000, ['Communication', 'Reservation Management', 'Microsoft Office'], 'Senior High School', 'On-site'],
    ['Kitchen Assistant', 15000, 21000, ['Food Preparation', 'Food Safety', 'Organization'], 'Vocational / TESDA', 'On-site'],
    ['Housekeeping Attendant', 15000, 20000, ['Housekeeping', 'Attention to Detail', 'Time Management'], 'Senior High School', 'On-site'],
    ['Food and Beverage Supervisor', 23000, 32000, ['Food Safety', 'Team Leadership', 'Inventory Management'], 'Vocational / TESDA', 'On-site'],
    ['Events Coordinator', 22000, 32000, ['Event Planning', 'Scheduling', 'Communication'], "Bachelor's Degree", 'On-site'],
  ] },
  { industry: 'Retail / Wholesale', company: 'Community Retail', service: 'neighborhood retail and inventory distribution', preferred: ['Merchandising', 'Microsoft Excel'], roles: [
    ['Retail Sales Associate', 15000, 22000, ['Customer Service', 'Sales', 'Communication'], 'Senior High School', 'On-site'],
    ['Store Cashier', 15000, 21000, ['Cash Handling', 'Customer Service', 'Attention to Detail'], 'Senior High School', 'On-site'],
    ['Inventory Clerk', 17000, 24000, ['Inventory Management', 'Microsoft Excel', 'Organization'], 'Senior High School', 'On-site'],
    ['Store Supervisor', 22000, 31000, ['Team Leadership', 'Sales', 'Inventory Management'], 'College Undergraduate', 'On-site'],
    ['Purchasing Assistant', 20000, 29000, ['Procurement', 'Microsoft Excel', 'Negotiation'], "Bachelor's Degree", 'On-site'],
  ] },
  { industry: 'Agriculture / Agribusiness', company: 'Harvest Cooperative', service: 'crop production and agricultural supply coordination', preferred: ['Record Keeping', 'Teamwork'], roles: [
    ['Farm Operations Assistant', 16000, 23000, ['Crop Production', 'Farm Safety', 'Organization'], 'Vocational / TESDA', 'On-site'],
    ['Agricultural Technician', 20000, 28000, ['Crop Production', 'Soil Management', 'Data Collection'], 'Vocational / TESDA', 'On-site'],
    ['Produce Quality Inspector', 18000, 26000, ['Quality Control', 'Food Safety', 'Attention to Detail'], 'Senior High School', 'On-site'],
    ['Agribusiness Sales Associate', 22000, 31000, ['Sales', 'Customer Service', 'Agriculture'], "Bachelor's Degree", 'On-site'],
    ['Farm Planning Officer', 26000, 37000, ['Agriculture', 'Microsoft Excel', 'Project Planning'], "Bachelor's Degree", 'On-site'],
  ] },
  { industry: 'Fisheries / Food Processing', company: 'Coastal Foods', service: 'seafood processing and responsible cold-chain operations', preferred: ['Record Keeping', 'Teamwork'], roles: [
    ['Seafood Processing Associate', 15000, 22000, ['Food Safety', 'Food Processing', 'Attention to Detail'], 'Senior High School', 'On-site'],
    ['Aquaculture Technician', 20000, 29000, ['Aquaculture', 'Water Quality Testing', 'Data Collection'], 'Vocational / TESDA', 'On-site'],
    ['Cold Storage Assistant', 18000, 25000, ['Inventory Management', 'Safety Procedures', 'Record Keeping'], 'Senior High School', 'On-site'],
    ['Food Quality Analyst', 25000, 35000, ['Quality Control', 'Food Safety', 'Laboratory Testing'], "Bachelor's Degree", 'On-site'],
    ['Processing Shift Supervisor', 25000, 36000, ['Team Leadership', 'Food Safety', 'Production Planning'], 'Vocational / TESDA', 'On-site'],
  ] },
  { industry: 'Logistics / Transportation', company: 'Island Logistics', service: 'local delivery and warehouse coordination', preferred: ['Microsoft Excel', 'Customer Service'], roles: [
    ['Warehouse Assistant', 16000, 23000, ['Inventory Management', 'Organization', 'Safety Procedures'], 'Senior High School', 'On-site'],
    ['Dispatch Coordinator', 19000, 27000, ['Scheduling', 'Communication', 'Route Planning'], 'College Undergraduate', 'On-site'],
    ['Delivery Operations Clerk', 18000, 25000, ['Data Entry', 'Communication', 'Record Keeping'], 'Senior High School', 'On-site'],
    ['Fleet Maintenance Technician', 24000, 34000, ['Vehicle Maintenance', 'Troubleshooting', 'Safety Procedures'], 'Vocational / TESDA', 'On-site'],
    ['Supply Chain Analyst', 28000, 40000, ['Microsoft Excel', 'Data Analysis', 'Inventory Management'], "Bachelor's Degree", 'Hybrid'],
  ] },
  { industry: 'Healthcare / Community Services', company: 'Community Care Services', service: 'non-clinical community care and clinic administration', preferred: ['First Aid', 'Microsoft Office'], roles: [
    ['Clinic Receptionist', 17000, 24000, ['Customer Service', 'Scheduling', 'Communication'], 'Senior High School', 'On-site'],
    ['Medical Records Assistant', 19000, 27000, ['Data Entry', 'Confidentiality', 'Attention to Detail'], 'College Undergraduate', 'On-site'],
    ['Community Outreach Assistant', 18000, 26000, ['Communication', 'Community Engagement', 'Organization'], 'College Undergraduate', 'On-site'],
    ['Patient Services Coordinator', 22000, 32000, ['Customer Service', 'Scheduling', 'Problem Solving'], "Bachelor's Degree", 'On-site'],
    ['Healthcare Administrative Officer', 26000, 36000, ['Microsoft Excel', 'Administration', 'Confidentiality'], "Bachelor's Degree", 'On-site'],
  ] },
  { industry: 'Construction / Skilled Trades', company: 'Buildworks Services', service: 'building maintenance and construction support', preferred: ['Blueprint Reading', 'Teamwork'], roles: [
    ['Construction Office Assistant', 17000, 24000, ['Microsoft Office', 'Record Keeping', 'Organization'], 'Senior High School', 'On-site'],
    ['Electrical Technician', 22000, 32000, ['Electrical Installation', 'Troubleshooting', 'Safety Procedures'], 'Vocational / TESDA', 'On-site'],
    ['Facilities Maintenance Technician', 21000, 30000, ['Maintenance', 'Troubleshooting', 'Safety Procedures'], 'Vocational / TESDA', 'On-site'],
    ['CAD Operator', 24000, 34000, ['AutoCAD', 'Technical Drawing', 'Attention to Detail'], 'Vocational / TESDA', 'On-site'],
    ['Project Site Coordinator', 29000, 42000, ['Project Planning', 'Communication', 'Safety Procedures'], "Bachelor's Degree", 'On-site'],
  ] },
  { industry: 'Accounting / Professional Services', company: 'Business Advisory', service: 'bookkeeping and small-business administrative support', preferred: ['Microsoft Office', 'Organization'], roles: [
    ['Accounting Assistant', 18000, 26000, ['Bookkeeping', 'Microsoft Excel', 'Attention to Detail'], "Bachelor's Degree", 'On-site'],
    ['Payroll Assistant', 21000, 29000, ['Payroll', 'Microsoft Excel', 'Confidentiality'], "Bachelor's Degree", 'Hybrid'],
    ['Administrative Assistant', 17000, 24000, ['Microsoft Office', 'Scheduling', 'Communication'], 'College Undergraduate', 'On-site'],
    ['Bookkeeper', 24000, 34000, ['Bookkeeping', 'QuickBooks', 'Microsoft Excel'], 'Vocational / TESDA', 'Remote'],
    ['Financial Reporting Analyst', 30000, 43000, ['Financial Analysis', 'Microsoft Excel', 'Accounting'], "Bachelor's Degree", 'Hybrid'],
  ] },
];
const firstNames = ['Althea', 'Benedict', 'Camille', 'Darius', 'Elena', 'Felix', 'Gabriela', 'Hugo', 'Isabel', 'Joaquin', 'Katrina', 'Lorenzo', 'Mara', 'Nico', 'Olivia', 'Paolo', 'Raisa', 'Santino', 'Teresa', 'Vincent'];
const lastNames = ['Abad', 'Bautista', 'Castillo', 'Domingo', 'Enriquez', 'Flores', 'Garcia', 'Herrera', 'Ilagan', 'Jimenez', 'Lacson', 'Mendoza', 'Navarro', 'Ortega', 'Pascual'];
const brands = ['Harborlight', 'Daybreak', 'Evergreen', 'Brightpath', 'New Leaf'];

function demoId(kind, number) {
  const hex = createHash('sha256').update(`mimaropa-local-demo-employers-v1:${kind}:${number}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function buildDemoEmployers() {
  return Array.from({ length: DEMO_COUNT }, (_, index) => {
    const number = index + 1;
    const wave = Math.floor(index / 60);
    const region = regions[index % regions.length];
    const sector = sectors[Math.floor(index / 5) % sectors.length];
    const [title, salaryMin, salaryMax, skills, education, setup] = sector.roles[wave];
    const municipality = region[2][(wave + Math.floor(index / 5)) % region[2].length];
    const companyName = `${brands[wave]} ${region[1]} ${sector.company}`;
    const name = `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length)]}`;
    const email = `employer${String(number).padStart(3, '0')}@demo.mimaropa.test`;
    const description = `DEMO COMPANY — Fictional local demonstration account. ${companyName} illustrates a MIMAROPA employer providing ${sector.service} in ${municipality}, ${region[0]}. Its recruiter, contact details, company information, and vacancy are sample data, not a real hiring offer.`;
    const jobDescription = `DEMO VACANCY — For local testing only; this is not a real hiring offer.\n\n${companyName} is looking for a ${title} in ${municipality}, ${region[0]}.\n\nResponsibilities\n• Support daily ${sector.service}.\n• Apply ${skills.join(', ')} to complete assigned work.\n• Coordinate with the team, keep accurate records, and follow workplace procedures.\n\nQualifications\n• ${education} or relevant training for this sample role.\n• ${wave < 2 ? 'Entry-level applicants are welcome.' : `${wave - 1} year(s) of relevant experience.`}\n• Clear communication and a dependable approach to work.\n\nSample monthly salary: PHP ${salaryMin.toLocaleString('en-US')}–${salaryMax.toLocaleString('en-US')}. ${setup} arrangement. Apply in this local app to try the employer and applicant workflow.`;
    const job = {
      id: demoId('job', number), title, company_name: companyName, description: jobDescription,
      industry: sector.industry, province: region[0], municipality,
      employment_type: wave === 1 && (index % 5 === 0) ? 'Part-time' : 'Full-time', work_setup: setup,
      salary_min: salaryMin, salary_max: salaryMax, required_skills: skills, preferred_skills: sector.preferred,
      education_required: education, experience_required: Math.max(0, wave - 1),
    };
    return {
      id: demoId('employer', number), number, name, email,
      company: {
        company_name: companyName, industry: sector.industry, description,
        address: `Demo Business Center, ${municipality}, ${region[0]} (fictional address)`,
        province: region[0], municipality, company_size: ['1–9', '10–49', '50–249', '250+'][index % 4],
        contact_person: name, contact_position: ['Recruitment Officer', 'Human Resources Manager', 'Talent Acquisition Specialist'][index % 3],
        business_email: email, contact_number: '+63 000 000 0000', website: '',
      },
      job,
    };
  });
}

export function assertLocalSeed(config, env = process.env) {
  if (String(env.NODE_ENV || '').trim().toLowerCase() === 'production') throw new Error('Demo seeding is disabled in production.');
  if (config.driver === 'mysql' && !['127.0.0.1', 'localhost', '::1'].includes(config.host))
    throw new Error('Demo seeding requires a local loopback database host.');
  if (config.driver === 'sqlite' && /^(?:\\\\|\/\/|[a-z]+:\/\/)/i.test(config.filename))
    throw new Error('Demo seeding requires a local SQLite file.');
  if (!['mysql', 'sqlite'].includes(config.driver)) throw new Error('Unsupported database driver.');
}

export async function inspectDemoSeed(db, entries = buildDemoEmployers()) {
  const ids = entries.map((entry) => entry.id);
  const emails = entries.map((entry) => entry.email);
  const jobIds = entries.map((entry) => entry.job.id);
  const marks = ids.map(() => '?').join(',');
  const users = await db.prepare(`SELECT id,email,role FROM users WHERE id IN (${marks}) OR email IN (${marks})`).all(...ids, ...emails);
  const companies = await db.prepare(`SELECT user_id,verification_status FROM employer_profiles WHERE user_id IN (${marks})`).all(...ids);
  const jobs = await db.prepare(`SELECT id,employer_id,status FROM jobs WHERE id IN (${marks}) OR employer_id IN (${marks})`).all(...jobIds, ...ids);
  const usersById = new Map(users.map((row) => [row.id, row]));
  const usersByEmail = new Map(users.map((row) => [row.email.toLowerCase(), row]));
  const companyIds = new Set(companies.map((row) => row.user_id));
  const jobsById = new Map(jobs.map((row) => [row.id, row]));
  const missing = [];
  for (const entry of entries) {
    const user = usersById.get(entry.id);
    const emailOwner = usersByEmail.get(entry.email);
    const job = jobsById.get(entry.job.id);
    if ((user && (user.email.toLowerCase() !== entry.email || user.role !== 'employer')) || (emailOwner && emailOwner.id !== entry.id) || (job && job.employer_id !== entry.id))
      throw new Error(`Seed identity collision at demo employer ${entry.number}; no existing rows will be changed.`);
    const found = [Boolean(user), companyIds.has(entry.id), Boolean(job)];
    if (found.some(Boolean) && !found.every(Boolean))
      throw new Error(`Incomplete seed record at demo employer ${entry.number}; restore its original rows before rerunning. No existing rows will be changed.`);
    if (!found[0]) missing.push(entry);
  }
  const expectedJobIds = new Set(jobIds);
  return {
    missing,
    summary: {
      requested: entries.length, existing_accounts: users.length, existing_companies: companies.length,
      existing_seed_jobs: jobs.filter((job) => expectedJobIds.has(job.id)).length,
      active_seed_jobs: jobs.filter((job) => expectedJobIds.has(job.id) && job.status === 'active').length,
      additional_jobs_created_by_demo_accounts: jobs.filter((job) => !expectedJobIds.has(job.id)).length,
      to_create: missing.length,
    },
  };
}

export async function loadDemoCredentials(entries, { path = DEMO_CREDENTIALS_PATH, allowCreate = false } = {}) {
  try {
    const text = await readFile(path, 'utf8');
    const lines = text.trim().split(/\r?\n/);
    if (lines.shift() !== 'email,password,company_name,contact_person') throw new Error('Unexpected credentials file header.');
    const credentials = new Map();
    for (const line of lines) {
      const [email, password, company, name, extra] = line.split(',');
      if (!email || !/^[A-Za-z0-9_-]{32}$/.test(password || '') || !company || !name || extra !== undefined || credentials.has(email))
        throw new Error('Malformed or duplicate demo credential row.');
      credentials.set(email, password);
    }
    if (credentials.size !== entries.length || entries.some((entry) => !credentials.has(entry.email)))
      throw new Error('Credentials file must contain the complete matching demo account set.');
    return credentials;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (!allowCreate) throw new Error('The original local demo credentials file is missing. Restore it before rerunning; existing passwords will not be reset.');
    const credentials = new Map(entries.map((entry) => [entry.email, randomBytes(24).toString('base64url')]));
    const csv = 'email,password,company_name,contact_person\n' + entries.map((entry) => `${entry.email},${credentials.get(entry.email)},${entry.company.company_name},${entry.name}`).join('\n') + '\n';
    await mkdir(dirname(path), { recursive: true });
    // Exclusive creation preserves credentials from earlier or concurrent runs.
    await writeFile(path, csv, { flag: 'wx', mode: 0o600 });
    return credentials;
  }
}

function insert(table, columns, values) {
  return { sql: `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, params: values, requireChanges: 1 };
}

export async function applyDemoSeed(db, { credentialsPath = DEMO_CREDENTIALS_PATH, now = Date.now() } = {}) {
  const entries = buildDemoEmployers();
  const before = await inspectDemoSeed(db, entries);
  const credentials = await loadDemoCredentials(entries, { path: credentialsPath, allowCreate: before.summary.existing_accounts === 0 });
  const operations = [];
  for (const entry of before.missing) {
    const hash = await argon2.hash(credentials.get(entry.email), { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    // Stagger sample postings over the previous 30 days for useful local filters.
    const createdAt = now - ((entry.number - 1) % 30) * 86400000;
    operations.push(insert('users', ['id', 'full_name', 'email', 'password_hash', 'auth_provider', 'email_verified', 'role', 'role_selected', 'profile_completion', 'account_status', 'terms_accepted_at', 'terms_version', 'created_at', 'updated_at'], [entry.id, entry.name, entry.email, hash, 'password', 1, 'employer', 1, 100, 'active', now, 'local-demo-v1', createdAt, now]));
    const companyColumns = ['company_name', 'industry', 'description', 'address', 'province', 'municipality', 'company_size', 'contact_person', 'contact_position', 'business_email', 'contact_number', 'website'];
    operations.push(insert('employer_profiles', ['user_id', ...companyColumns, 'verification_status', 'verification_reason', 'verified_at', 'verified_by', 'updated_at'], [entry.id, ...companyColumns.map((key) => entry.company[key]), 'verified', DEMO_REASON, now, null, now]));
    const job = entry.job;
    const normalized = `Job Title: ${job.title}\nIndustry: ${job.industry}\nDescription: ${job.description}\nRequired Skills: ${job.required_skills.join(', ')}\nPreferred Skills: ${job.preferred_skills.join(', ')}\nEducation: ${job.education_required}\nExperience: ${job.experience_required} years\nWork Setup: ${job.work_setup}\nLocation: ${job.municipality}, ${job.province}`;
    operations.push(insert('jobs', ['id', 'employer_id', 'title', 'company_name', 'description', 'industry', 'province', 'municipality', 'employment_type', 'work_setup', 'salary_min', 'salary_max', 'required_skills', 'preferred_skills', 'education_required', 'experience_required', 'status', 'created_at', 'vacancies', 'application_deadline', 'normalized_job_text', 'updated_at'], [job.id, entry.id, job.title, job.company_name, job.description, job.industry, job.province, job.municipality, job.employment_type, job.work_setup, job.salary_min, job.salary_max, JSON.stringify(job.required_skills), JSON.stringify(job.preferred_skills), job.education_required, job.experience_required, 'active', createdAt, 1, null, normalized, now]));
  }
  if (operations.length) await db.batch(operations);
  const after = await inspectDemoSeed(db, entries);
  if (after.summary.existing_accounts !== DEMO_COUNT || after.summary.existing_companies !== DEMO_COUNT || after.summary.existing_seed_jobs !== DEMO_COUNT)
    throw new Error('Seed verification did not find exactly 300 seed-owned accounts, companies, and jobs.');
  return { ...after.summary, created: before.missing.length, preserved: DEMO_COUNT - before.missing.length };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !['--dry-run', '--apply'].includes(args[0])) throw new Error('Usage: node server/seed-demo-employers.mjs --dry-run|--apply');
  const { config: loadEnv } = await import('dotenv');
  loadEnv({ quiet: true });
  const config = databaseConfig();
  assertLocalSeed(config);
  const dryRun = args[0] === '--dry-run';
  if (config.driver === 'sqlite' && config.filename !== ':memory:') await access(config.filename);
  // A SQLite dry run also avoids WAL setup or accidental file creation.
  const db = dryRun && config.driver === 'sqlite' ? new DatabaseSync(config.filename, { readOnly: true }) : await connectDatabase(config);
  try {
    const summary = dryRun ? (await inspectDemoSeed(db)).summary : await applyDemoSeed(db);
    console.log(JSON.stringify({ mode: dryRun ? 'dry-run' : 'applied', driver: config.driver, ...summary }, null, 2));
    if (!dryRun) console.log('Local credentials: server/data/demo-employers-credentials.csv (ignored by Git; passwords are never printed).');
  } finally {
    await db.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    // Database errors can embed SQL values, so avoid printing raw errors or passwords.
    console.error('Demo seeding stopped. Check local database settings, migrations, seed identity conflicts, and the original credentials file. No existing records are updated by this script.');
    process.exitCode = 1;
  });
}
