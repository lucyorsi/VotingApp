drop table if exists entries;

create table setup_vote (
  voteID integer primary key autoincrement,
  name text not null,
  expire_date date not null,
  expire_time time not null,
  vote_method integer not null,
  candidates_upload_method integer not null,
  candidates_input text not null,
  voters_upload_method integer not null,
  voters_input text not null
);