from flask.ext.mysql import MySQL
import app as a
import time

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
		secure_level integer not null, 
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
		candidate_name varchar(255) not null,
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

def create_vote(vote_name, expire_time, vote_method, candidate_upload_text):
	cursor = conn.cursor()
	cursor.execute("INSERT INTO votes_info (vote_name, expire_time, vote_method, secure_level) VALUES (%s, %s, %s, 1)", (vote_name, expire_time, vote_method))
	conn.commit()

	vote_id = cursor.lastrowid
	for index in range(len(candidate_upload_text)):
		cursor.execute("INSERT INTO candidates_list (vote_id, candidate_name) VALUES(%s, %s)", (vote_id, candidate_upload_text[index]))
		conn.commit()
	cursor.close()

	return vote_id

def check_vote_method(vote_id):
	cursor = conn.cursor()
	cursor.execute("SELECT * FROM votes_info WHERE vote_id=%s", (vote_id))
	conn.commit()

	results = cursor.rowcount
	if results != 0:
		results = cursor.fetchone()

	cursor.close()

	return results

def get_candidate_list(vote_id):
	cursor = conn.cursor()
	cursor.execute("SELECT * FROM candidates_list WHERE vote_id=%s", (vote_id))
	conn.commit()

	results = cursor.fetchall()

	cursor.close()

	return results

def count_ballot(candidate_id):
	cursor = conn.cursor()
	cursor.execute("SELECT * FROM ballots_info WHERE candidate_id=%s", (candidate_id))
	conn.commit()

	results = cursor.rowcount

	cursor.close()

	return results
