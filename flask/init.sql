DROP TABLE IF EXISTS ballots_info;
DROP TABLE IF EXISTS candidates_list;
DROP TABLE IF EXISTS qualified_voters;
DROP TABLE IF EXISTS votes_info;
DROP TABLE IF EXISTS user_info;

create table user_info (
	user_id integer primary key auto_increment,
	user_name varchar(255) not null,
	password varchar(255) not null,
	user_email varchar(255) not null
);

create table votes_info (
	vote_id integer primary key auto_increment,
	vote_name varchar(255) not null,
	creator_id integer,
	expire_time datetime not null,
	vote_method integer not null,
	secure_level integer not null, 
	foreign key (creator_id) references user_info(user_id)
);

create table qualified_voters(
	vote_id integer not null,
	voter_id integer not null,
	foreign key (vote_id) references votes_info(vote_id),
	foreign key (voter_id) references user_info(user_id)
);

create table candidates_list (
	candidate_id integer primary key auto_increment,
	vote_id integer not null ,
	candidate_name varchar(255) not null,
	foreign key (vote_id) references votes_info(vote_id)
);

create table ballots_info (
	ballot_id integer primary key auto_increment,
	vote_id integer not null,
	candidate_id integer not null,
	voter_id integer,
	foreign key (candidate_id) references candidates_list(candidate_id),
	foreign key (voter_id) references user_info(user_id)
);
