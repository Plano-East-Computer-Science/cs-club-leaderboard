-- Demo data for a local ship cycle (D1/D4): a running cycle with entries, devlogs and a
-- teammate post. Local only: apply with `wrangler d1 execute cs-club --local --file worker/seed-cycles.sql`.
-- Never run against production; the members are made up and use example.test addresses.
INSERT OR IGNORE INTO students (id, name) VALUES (9001, 'Maya Chen'), (9002, 'Jordan Reyes'), (9003, 'Priya Nair'), (9004, 'Sam Okafor'), (9005, 'Lena Fischer');
INSERT OR IGNORE INTO users (id, email, name, student_id) VALUES
  (9001, 'maya@example.test', 'Maya Chen', 9001), (9002, 'jordan@example.test', 'Jordan Reyes', 9002),
  (9003, 'priya@example.test', 'Priya Nair', 9003), (9004, 'sam@example.test', 'Sam Okafor', 9004),
  (9005, 'lena@example.test', 'Lena Fischer', 9005);
INSERT OR IGNORE INTO projects (id, user_id, title, description, track, repo_url, demo_url) VALUES
  (9001, 9001, 'Lunchbot', 'A Discord bot that posts the cafeteria menu each morning.', 'projects', 'https://github.com/example/lunchbot', ''),
  (9002, 9003, 'Dungeon Dash', 'A tiny roguelike that runs in the terminal.', 'projects', 'https://github.com/example/dungeon-dash', 'https://example.com/dungeon'),
  (9003, 9005, 'Study Timer', 'A pomodoro timer with a quiet weekly report.', 'projects', '', '');
INSERT OR IGNORE INTO cycles (id, slug, title, theme, rubric, starts_on, demo_on, status) VALUES
  (9001, 'tools-for-the-club', 'Tools for the club', 'Build something the club or the school would actually use. A bot, a site, a script. It has to run by demo day.', 'Does it run, is it clear what it is for, and did you finish something.', date('now', '-8 days'), date('now', '+12 days'), 'open');
INSERT OR IGNORE INTO cycle_entries (id, cycle_id, project_id, pitch) VALUES
  (9001, 9001, 9001, 'A Discord bot that posts the cafeteria menu each morning'),
  (9002, 9001, 9002, 'A tiny roguelike you can finish in ten minutes'),
  (9003, 9001, 9003, 'A study timer that tells you how your week went');
INSERT OR IGNORE INTO cycle_members (entry_id, cycle_id, user_id, is_owner) VALUES
  (9001, 9001, 9001, 1), (9001, 9001, 9002, 0), (9002, 9001, 9003, 1), (9002, 9001, 9004, 0), (9003, 9001, 9005, 1);
INSERT OR IGNORE INTO devlogs (id, entry_id, user_id, text, url, created_at) VALUES
  (9001, 9001, 9001, 'Bot connects and answers /menu with a hardcoded list.', '', datetime('now', '-6 days')),
  (9002, 9001, 9002, 'Scraper pulls the real menu page. Next: caching so we do not hit the site on every command.', 'https://github.com/example/lunchbot', datetime('now', '-3 days')),
  (9003, 9001, 9001, 'Posts at 7am now. Fixed the weekend crash.', '', datetime('now', '-1 days')),
  (9004, 9002, 9003, 'Rooms generate randomly and you can walk between them.', '', datetime('now', '-5 days')),
  (9005, 9002, 9004, 'Added three enemy types and a health bar made of hash marks.', '', datetime('now', '-2 days')),
  (9006, 9003, 9005, 'Timer counts down and rings. Report page is next.', '', datetime('now', '-4 days'));
INSERT OR IGNORE INTO team_posts (id, user_id, target_type, target_id, text, skills) VALUES
  (9001, 9005, 'cycle', 9001, 'Study Timer needs someone to make the weekly report look good. Find me at the next meeting.', 'css, charts');
