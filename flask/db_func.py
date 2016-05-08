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
	cursor.execute('''DROP TABLE IF EXISTS list_element;''')
	conn.commit()
	cursor.execute('''DROP TABLE IF EXISTS ranking_list_info;''')
	conn.commit()
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
		user_email varchar(255) not null unique,
		user_key varchar(1024) not null
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
		already_vote integer not null,
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
		candidate_point integer,
		yes_no integer,
		voter_id integer,
		foreign key (candidate_id) references candidates_list(candidate_id),
		foreign key (voter_id) references user_info(user_id),
		foreign key (vote_id) references votes_info(vote_id)
	);''')
	conn.commit()
	cursor.execute('''create table ranking_list_info (
		list_id integer primary key auto_increment,
		vote_id integer not null,
		voter_id integer,
		foreign key (vote_id) references votes_info(vote_id)
	);''')
	conn.commit()
	cursor.execute('''create table list_element (
		elem_id integer primary key auto_increment,
		list_id integer not null,
		candidate_id integer not null,
		rank integer not null,
		foreign key (list_id) references ranking_list_info(list_id),
		foreign key (candidate_id) references candidates_list(candidate_id)
	);''')
	conn.commit()

	cursor.close()

	return

def create_vote(vote_name, expire_time, vote_method, candidate_upload_text, secure_level, voter_id_list, creator_id):
	cursor = conn.cursor()

	if(secure_level != 1):
		cursor.execute("INSERT INTO votes_info (vote_name, expire_time, vote_method, secure_level, creator_id) VALUES (%s, %s, %s, %s, %s)", (vote_name, expire_time, vote_method, secure_level, creator_id))
		conn.commit()
	else:
		cursor.execute("INSERT INTO votes_info (vote_name, expire_time, vote_method, secure_level) VALUES (%s, %s, %s, %s)", (vote_name, expire_time, vote_method, secure_level))
		conn.commit()

	vote_id = cursor.lastrowid
	for index in range(len(candidate_upload_text)):
		cursor.execute("INSERT INTO candidates_list (vote_id, candidate_name) VALUES(%s, %s)", (vote_id, candidate_upload_text[index]))
		conn.commit()

	if(secure_level != 1):
		for index in range(len(voter_id_list)):
			cursor.execute("INSERT INTO qualified_voters (vote_id, voter_id, already_vote) VALUES(%s, %s, 0)", (vote_id, voter_id_list[index]))
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

def cast_single_vote(vote_id, candidate_id):
	cursor = conn.cursor()
	cursor.execute("INSERT INTO ballots_info (vote_id, candidate_id) VALUES(%s, %s)", (vote_id, candidate_id))
	conn.commit()
	cursor.close()

def cast_weight_vote(vote_id, candidate_id, candidate_point):
	cursor = conn.cursor()
	cursor.execute("INSERT INTO ballots_info (vote_id, candidate_id, candidate_point) VALUES(%s, %s, %s)", (vote_id, candidate_id, candidate_point))
	conn.commit()
	cursor.close()

def count_candidate_total_point(vote_id, candidate_id):
	cursor = conn.cursor()
	cursor.execute("SELECT * FROM ballots_info WHERE candidate_id=%s AND vote_id=%s", (candidate_id, vote_id))
	conn.commit()

	results = cursor.fetchall()
	total_points = 0
	for row in results:
		total_points = total_points + int(row[3])
	cursor.close()
	return total_points

def cast_majority_vote(vote_id, candidate_id, yes_no):
	cursor = conn.cursor()
	cursor.execute("INSERT INTO ballots_info (vote_id, candidate_id, yes_no) VALUES(%s, %s, %s)", (vote_id, candidate_id, yes_no))
	conn.commit()
	cursor.close()

def count_candidate_total_yes(vote_id, candidate_id):
	cursor = conn.cursor()
	cursor.execute("SELECT * FROM ballots_info WHERE candidate_id=%s AND vote_id=%s AND yes_no=%s", (candidate_id, vote_id, '1'))
	conn.commit()

	total_yes = cursor.rowcount
	cursor.close()
	return total_yes

def create_new_list(vote_id):
	cursor = conn.cursor()
	cursor.execute("INSERT INTO ranking_list_info (vote_id) VALUES(%s)", (vote_id))
	conn.commit()
	list_id = cursor.lastrowid
	cursor.close()
	return list_id

def insert_new_list_elem(list_id, candidate_id, rank):
	cursor = conn.cursor()
	cursor.execute("INSERT INTO list_element (list_id, candidate_id, rank) VALUES(%s, %s, %s)", (list_id, candidate_id, rank))
	conn.commit()
	cursor.close()

def execute_sql_select(sql):
	cursor = conn.cursor()
	cursor.execute(sql)
	result = cursor.fetchall()
	conn.commit()
	cursor.close()
	return result

def execute_sql_insert(sql):
	cursor = conn.cursor()
	cursor.execute(sql)
	conn.commit()
	row_id = cursor.lastrowid
	cursor.close()
	return row_id

def execute_sql_insert_user_info(username, password, email, user_key):
	cursor = conn.cursor()
	error = 0
	try:
		cursor.execute("INSERT INTO user_info (user_name, password, user_email, user_key) VALUES(%s, MD5(%s), %s, %s)", (username, password, email, user_key))
	except:
		error = 1
		print "duplicate entry"
		return error, 0
	conn.commit()
	result = cursor.fetchall();
	row_id = cursor.lastrowid
	cursor.close()
	return error, row_id
