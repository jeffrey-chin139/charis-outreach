# Charis Outreach

Mobile-first outreach recording MVP for Charis Outreach.

The application follows `Charis_Outreach_Design_Document_v5_Zero_Budget.docx` and imports the initial residential data from `neighbourhood master list.xlsx`.

## Stack

- Next.js with TypeScript
- Supabase/PostgreSQL for database and administrator authentication
- Server-side API routes for anonymous volunteer writes and safe Do Not Revisit lookups
- Vercel-compatible deployment
- No paid Microsoft Power Platform, Dataverse, or paid UI dependencies

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
copy .env.example .env.local
```

3. Fill in:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
MASTER_LIST_PATH
```

4. Apply the SQL migration in `supabase/migrations/001_initial_schema.sql` to your Supabase project.

5. Import the master list:

```bash
npm run import:master
```

The importer deduplicates rows by `Neighbourhood + Block + Floor + Stack` and writes `master-import-report.json`.

6. Start the local app:

```bash
npm run dev
```

## Administrator Setup

1. Create an admin user in Supabase Auth.
2. Insert that user into `admin_profiles`:

```sql
insert into public.admin_profiles (user_id, display_name, active)
values ('AUTH_USER_UUID', 'Admin', true);
```

3. Open `/admin` and sign in.

## Volunteer Security Model

Volunteers do not log in. Public pages call server-side API routes.

Anonymous volunteers can:

- generate active residential units from the master list;
- see only whether a generated unit is actively Do Not Revisit;
- create residential visits only for validated active master units;
- create Street E encounters.

Anonymous volunteers cannot browse visit history, historical remarks, contact details, administrator records, or raw database tables.

## Database Notes

Historical residential visit rows store snapshots of neighbourhood, block, floor, stack, and unit label. This means administrators can correct or deactivate master records without destroying historical visit records.

Selecting `Do not revisit` as a residential outcome activates persistent Do Not Revisit status. Administrators can clear or restore that status in `/admin`.

## Backups and Export

Use the admin CSV export for routine filtered exports. For full database backup, use Supabase dashboard exports or `pg_dump` against the project connection string.

## Deployment

Recommended zero-budget path:

1. Push this folder to a Git repository.
2. Create a free Supabase project.
3. Apply migrations and import the master list.
4. Create an admin auth user and `admin_profiles` row.
5. Deploy to Vercel free tier.
6. Add the same environment variables in Vercel project settings.

Free-tier limits can change. For a small volunteer outreach project, the expected usage should fit normal free Supabase and Vercel limits, but export backups regularly.

## Tests

```bash
npm test
```

Critical rules covered include:

- invalid floor/stack combinations are not generated;
- Unrecorded is not a completed outcome;
- Street E outcomes remain separate from residential-only outcomes;
- unit labels preserve the source floor/stack strings.
