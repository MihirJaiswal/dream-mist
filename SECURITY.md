# Security policy

## Reporting a problem

Please don't report security problems in public issues, discussions or pull requests.

Report them privately through GitHub: open the [Security tab](https://github.com/MihirJaiswal/dream-mist/security) of this repository and press **Report a vulnerability**. Include:

- what the problem is and what an attacker could do with it
- the steps to reproduce it, or a proof of concept
- the page, file or Supabase table involved

You should hear back within a week. Once the problem is fixed, it will be credited to you in the release notes unless you'd rather stay anonymous.

## What counts

- Ways to read, change or delete other players' cities, profiles, likes or uploads, for example a missing or wrong row level security rule in `supabase/migrations/`
- Ways to run scripts in other players' browsers through a city file, share link, uploaded image or docs page
- Secrets committed to the repository

The Supabase URL and publishable key are public by design and are not a vulnerability on their own.

## Supported versions

Only the latest `main` branch and the site deployed from it get security fixes.
