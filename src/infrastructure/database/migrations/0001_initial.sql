CREATE TABLE guilds (
  id TEXT PRIMARY KEY,
  default_channel_id TEXT,
  timezone TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE planning_rounds (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guilds(id),
  channel_id TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT,
  availability_closes_at TEXT,
  selected_date TEXT,
  selected_host_user_id TEXT,
  finalized_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX planning_rounds_status_deadline_idx ON planning_rounds(status, availability_closes_at);

CREATE TABLE round_candidate_dates (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES planning_rounds(id),
  candidate_date TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  UNIQUE(round_id, candidate_date)
);

CREATE TABLE availability_responses (
  round_id TEXT NOT NULL REFERENCES planning_rounds(id),
  user_id TEXT NOT NULL,
  candidate_date_id TEXT NOT NULL REFERENCES round_candidate_dates(id),
  submitted_at TEXT NOT NULL,
  PRIMARY KEY(round_id, user_id, candidate_date_id)
);

CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guilds(id),
  display_name TEXT NOT NULL,
  created_by_user_id TEXT,
  first_suggested_at TEXT NOT NULL,
  last_suggested_at TEXT NOT NULL,
  selected_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE activity_votes (
  round_id TEXT NOT NULL REFERENCES planning_rounds(id),
  user_id TEXT NOT NULL,
  activity_id TEXT NOT NULL REFERENCES activities(id),
  voted_at TEXT NOT NULL,
  PRIMARY KEY(round_id, user_id, activity_id)
);

CREATE TABLE activity_proposals (
  round_id TEXT NOT NULL REFERENCES planning_rounds(id),
  user_id TEXT NOT NULL,
  activity_id TEXT NOT NULL REFERENCES activities(id),
  proposed_at TEXT NOT NULL,
  PRIMARY KEY(round_id, user_id)
);

CREATE TABLE hosting_volunteers (
  round_id TEXT NOT NULL REFERENCES planning_rounds(id),
  user_id TEXT NOT NULL,
  volunteered_at TEXT NOT NULL,
  PRIMARY KEY(round_id, user_id)
);

CREATE TABLE hosting_history (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guilds(id),
  round_id TEXT NOT NULL REFERENCES planning_rounds(id),
  user_id TEXT NOT NULL,
  hosted_on TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  UNIQUE(round_id)
);

CREATE TABLE round_announcements (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES planning_rounds(id),
  kind TEXT NOT NULL,
  discord_message_id TEXT NOT NULL,
  posted_at TEXT NOT NULL,
  UNIQUE(round_id, kind)
);
