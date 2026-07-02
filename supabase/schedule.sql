-- PDDapp scheduled price checks via Supabase pg_cron + pg_net.
--
-- This makes Supabase call your deployed /api/cron endpoint on a frequent
-- schedule (every 15 minutes below) for free — bypassing the Vercel Hobby
-- once-per-day cron limit.
--
-- Setup:
--   1. Deploy the app to Vercel and note its URL.
--   2. In Supabase: Database → Extensions → enable `pg_cron` and `pg_net`.
--   3. Edit the URL and Bearer token below, then run this in the SQL Editor.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- (Re)create the schedule. Adjust '*/15 * * * *' to taste (e.g. '*/5 * * * *').
select
  cron.schedule(
    'pddapp-check-prices',
    '*/15 * * * *',
    $$
    select net.http_post(
      url := 'https://YOUR-APP.vercel.app/api/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_CRON_SECRET'
      ),
      body := '{}'::jsonb
    );
    $$
  );

-- Inspect or remove:
--   select * from cron.job;
--   select cron.unschedule('pddapp-check-prices');
