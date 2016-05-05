from flask.ext.mysql import MySQL
import app as a

app = a.app

mysql = MySQL()

# MySQL configurations
app.config['MYSQL_DATABASE_USER'] = 'root'
app.config['MYSQL_DATABASE_PASSWORD'] = 'password'
app.config['MYSQL_DATABASE_DB'] = 'AnotherVote'
app.config['MYSQL_DATABASE_HOST'] = 'localhost'
mysql.init_app(app)

conn = mysql.connect()


def create_database():

	cursor = conn.cursor()
	cursor.execute('''DROP TABLE IF EXISTS ballots_info;''')
	conn.commit()
	cursor.execute('''DROP TABLE IF EXISTS candidates_list;''')
	conn.commit()
	cursor.execute('''DROP TABLE IF EXISTS qualified_voters;''')
	conn.commit()
	cursor.execute('''DROP TABLE IF EXISTS votes_info;''')
	conn.commit()
	cursor.execute('''DROP TABLE IF EXISTS user_info;''')
	conn.commit()

	cursor.execute('''create table user_info (
		user_id integer primary key auto_increment,
		user_name varchar(255) not null,
		password varchar(255) not null,
		user_email varchar(255) not null
	);''')
	conn.commit()
	cursor.execute('''create table votes_info (
		vote_id integer primary key auto_increment,
		vote_name varchar(255) not null,
		creator_id integer,
		expire_time datetime not null,
		vote_method integer not null,
		foreign key (creator_id) references user_info(user_id)
	);''')
	conn.commit()
	cursor.execute('''create table qualified_voters (
		vote_id integer not null,
		voter_id integer not null,
		foreign key (vote_id) references votes_info(vote_id),
		foreign key (voter_id) references user_info(user_id)
	);''')
	conn.commit()
	cursor.execute('''create table candidates_list (
		candidate_id integer primary key auto_increment,
		vote_id integer not null ,
		canditate_name varchar(255) not null,
		foreign key (vote_id) references votes_info(vote_id)
	);''')
	conn.commit()
	cursor.execute('''create table ballots_info (
		ballot_id integer primary key auto_increment,
		vote_id integer not null,
		candidate_id integer not null,
		voter_id integer,
		foreign key (candidate_id) references candidates_list(candidate_id),
		foreign key (voter_id) references user_info(user_id)
	);''')
	conn.commit()

	cursor.close()

	return

def create_vote():
	cursor = conn.cursor()
	cursor.execute('''DROP TABLE IF EXISTS ballots_info;''')
	conn.commit()