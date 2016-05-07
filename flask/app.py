# all the imports
import os
from flask import Flask, render_template, url_for, request, session, g, redirect, abort, flash
from flask.ext.mysql import MySQL
import db_func
import time
import datetime
import socket
from binascii import hexlify

app = Flask(__name__)

app.secret_key = "igroup-4140proj"

port_number = 5000

@app.route("/init_database")
def init_database():
	db_func.create_database()
	return render_template('index.html')

@app.route("/")
def main():
	return render_template('index.html')

@app.route("/setup")
def setup():
	if 'user_id' in session:
		secure_level = 2
		return render_template('setup.html', **locals())
	else:
		secure_level = 1
		return render_template('setup.html', **locals())

@app.route("/input_id", methods=["POST"])
def input_id():
	print "haha"
	input_id = request.form["input_id"]
	print input_id
	print "haha"
	return redirect("cast_a_vote/" + str(input_id))


@app.route("/register", methods=["POST"])
def register():
	user_name = request.form["signup-username"]
	user_email = request.form["signup-email"]
	password =  request.form["signup-password"]
	key = hexlify(os.urandom(512))
	error, row_id = db_func.execute_sql_insert_user_info(user_name, password, user_email, key)
	print error, row_id
	if error == 1:
		warning = "This email has already been used!"
		return render_template('notification.html', **locals())
	else:
		success = "You have successfully registered an account!"
		return render_template('notification.html', **locals())


@app.route("/login", methods=["POST"])
def login():
	login_email = request.form['login-email']
	login_password = request.form['login-password']
	query = "SELECT * FROM user_info WHERE password=MD5('" + str(login_password) + "') AND user_email='" + str(login_email) + "'"
	results = db_func.execute_sql_select(query)
	if( len(results) == 1):
		#login success
		print (results[0][0], results[0][1])
		results = db_func.execute_sql_select(query)
		session['user_name'] = results[0][1]
		session['user_id'] = results[0][0]
		return redirect('/home')
	else:
		warning = "Login failed!"
		return render_template('notification.html', **locals())

	return render_template('index.html')

@app.route("/logout")
def logout():
	session.pop('user_name', None)
	session.pop('user_id', None)
	return render_template('index.html')

@app.route("/home")
def home():
	if session['user_name']:
		query = "SELECT * FROM votes_info WHERE creator_id='" + str(session['user_id']) + "'"
		initiated_votes = db_func.execute_sql_select(query)
		query = "SELECT vote_id FROM qualified_voters WHERE voter_id='" + str(session['user_id']) + "'"
		cast_votes_id = db_func.execute_sql_select(query)
		print cast_votes_id
		cast_votes = {}
		for i in range(len(cast_votes_id)):
			query = "SELECT * FROM votes_info WHERE vote_id='" + str(cast_votes_id[i][0]) + "'"
			cast_votes[i] = db_func.execute_sql_select(query)[0]
		initiated_votes_num = len(initiated_votes)
		cast_votes_num = len(cast_votes)
		print cast_votes_num
		print cast_votes
		return render_template('home.html', **locals())
	else:
		warning = "You are not logged in!"
		return render_template('notification.html', ** locals())

@app.route("/cast_a_vote/<vote_id>")
def cast_a_vote(vote_id):
	results = db_func.check_vote_method(vote_id)
	# Check whether vote_id exists
	if (results == 0):
		warning = "Sorry, the vote does not exist."
		return render_template('notification.html', **locals())
	else:
		vote_id = results[0]
		vote_name = results[1]
		expire_time = results[3]
		vote_method = results[4]
		# Check whether vote has expired
		current_time = datetime.datetime.strftime(datetime.datetime.now(), "%Y-%m-%d %H:%M:%S")
		if datetime.datetime.strftime(expire_time, "%Y-%m-%d %H:%M:%S") < current_time:
			warning = "Sorry, the vote has already ended."
			return render_template('notification.html', **locals())
		else:
			#Check vote qualification
			if results[5] == 2:
				query = "SELECT * FROM qualified_voters WHERE vote_id='" + str(vote_id) + "' AND voter_id='" + str(session['user_id']) + "'"
				voter_list = db_func.execute_sql_select(query)
				if (len(voter_list) == 0):
					warning = "Sorry, you are not allowed to vote."
					return render_template('notification.html', **locals())
				elif (voter_list[0][2] == 1):
					warning = "Sorry, you are already voted."
					return render_template('notification.html', **locals())

			results = db_func.get_candidate_list(vote_id)
			candidate_num = len(results)
			candidate_list = {}
			i = 0
			for row in results:
				candidate_list[i, 0] = row[2] #candidate name
				candidate_list[i, 1] = row[0] #candidate id
				i = i + 1
			if (vote_method == 1):
				return render_template('vote_single.html', **locals())
			elif (vote_method == 2):
				return render_template('vote_ranking.html', **locals())
			elif (vote_method == 3):
				return render_template('vote_weight.html', **locals())
			elif (vote_method == 4):
				return render_template('vote_majority.html', **locals())


@app.route("/receive_a_vote", methods=["POST"])
def receive_a_vote():
	vote_method = request.form['vote_method']
	vote_method = int(vote_method)
	# print (type(vote_method) is str)
	# print (type(vote_method) is int)
	print vote_method

	vote_name = request.form['vote_name']
	vote_id = int(request.form['vote_id'])
	candidate_num = int(request.form['candidate_num'])

	results = db_func.get_candidate_list(vote_id)
	candidate_list = {}
	i = 0
	for row in results:
		candidate_list[i, 0] = row[2] #candidate name
		candidate_list[i, 1] = row[0] #candidate id
		i = i + 1

	if (vote_method == 1):
		candidate_id = int(request.form['input_candidate'])
		db_func.cast_single_vote(vote_id, candidate_id)

	elif (vote_method == 2):
		i = 0
		for row in results:
			candidate_list[i, 2] = request.form[str(candidate_list[i, 1])] #candidate rank
			i = i + 1
		# Check no two same ranks
		for i in range(candidate_num):
			for j in range(candidate_num):
				if(candidate_list[i, 2] == candidate_list[j, 2] and i != j):
					warning = "You have duplicate rank number!"
					return render_template('vote_ranking.html', **locals())
		# Ask the database to create a new list and get list_id
		list_id = db_func.create_new_list(vote_id)
		for i in range(candidate_num):
			db_func.insert_new_list_elem(list_id, candidate_list[i, 1], candidate_list[i, 2])

	elif (vote_method == 3):
		i = 0
		for row in results:
			candidate_list[i, 2] = request.form[str(candidate_list[i, 1])] #candidate points
			i = i + 1
		# Check total points not bigger than 100
		total_point = 0
		for i in range(candidate_num):
			total_point = total_point + int(candidate_list[i, 2])
		print "total point: " + str(total_point)
		if (total_point > 100):
			warning = "Your total points should be less than or equal to 100."
			return render_template('vote_weight.html', **locals())
		# Insert to database
		for i in range(candidate_num):
			db_func.cast_weight_vote(vote_id, candidate_list[i, 1], candidate_list[i, 2])

	elif (vote_method == 4):
		i = 0
		for row in results:
			candidate_list[i, 2] = request.form[str(candidate_list[i, 1])] #candidate yes_no value
			i = i + 1
		# Insert to database
		for i in range(candidate_num):
			db_func.cast_majority_vote(vote_id, candidate_list[i, 1], candidate_list[i, 2])

	query = "UPDATE qualified_voters SET already_vote=1 WHERE voter_id='" + str(session['user_name']) + "' AND vote_id='" + str(vote_id) + "'" 
	db_func.execute_sql_insert(query)
	return render_template('thanks.html', **locals())

@app.route("/view_result/<vote_id>")
def view_result(vote_id):
	results = db_func.check_vote_method(vote_id)
	# Check whether vote_id exists
	if (results == 0):
		warning = "Sorry, the vote does not exist."
		return render_template('notification.html', **locals())
	vote_name = results[1]
	expire_time = results[3]
	vote_method = results[4]
	secure_level = results[5]
	if (secure_level != 1):
		if ('user_id' in session):
			query = "SELECT * FROM votes_info WHERE creator_id='" + str(session['user_id']) + "' AND vote_id='" + str(vote_id) + "'"
			correct_vote = db_func.execute_sql_select(query)
			if len(correct_vote) == 0:
				warning = "You are not authorized to view this!"
				return render_template('notification.html', ** locals())
		else:
			warning = "You are not authorized to view this!"
			return render_template('notification.html', ** locals())

	results = db_func.get_candidate_list(vote_id)

	candidate_num = len(results)
	result_table = {}

	index = 0
	for row in results:
		result_table[index, 0] = row[0] #candidate id
		result_table[index, 1] = row[2] #candidate name
		index = index + 1

	if vote_method == 1:
		vote_method = "Single"
		for i in range(candidate_num):
			results = db_func.count_ballot(result_table[i, 0]) #candidate id
			result_table[i, 2] = results 

	elif vote_method == 2:
		vote_method = "Ranking"
		query = "SELECT * FROM ranking_list_info WHERE vote_id='" + str(vote_id) + "'"
		results = db_func.execute_sql_select(query)
		
		list_table = {}
		index = 0
		for row in results:
			list_table[index, 0] = row[0] #list id
			index = index + 1
		list_num = index

		if(list_num == 0):
			warning = "No vote yet"
			return render_template('results.html', **locals())

		# Reconstruct all rank list
		print "Print all list:"
		for i in range(list_num):
			query = "SELECT * FROM list_element WHERE list_id='" + str(list_table[i, 0]) + "' ORDER BY rank ASC"
			results = db_func.execute_sql_select(query)
			list_table[i, 1] = []
			for row in results:
				list_table[i, 1].append(row[2]) #candidate id
			print list_table[i, 1]

		round_count = 1
		remove_list = {}
		pass_half = 0
		half_vote = list_num / 2
		if (list_num % 2 != 0):
			half_vote = half_vote + 1
		while(pass_half == 0):
			whether_update = 0
			#Count vote 
			remove_list[round_count, 0] = [] #store removed candidate id
			remove_list[round_count, 1] = [] #store removed candidate name
			for i in range(candidate_num):
				result_table[i, 2] = 0
			for i in range(list_num):
				for j in range(candidate_num):
					if(list_table[i, 1][0] == result_table[j, 0]):
						result_table[j, 2] = result_table[j, 2] + 1
			#Check each candidate how many first vote
			least_vote = result_table[0, 2]
			for i in range(candidate_num):
				if(least_vote > result_table[i, 2]):
					least_vote = result_table[i, 2]
			for i in range(candidate_num):
				if(least_vote == result_table[i, 2]):
					remove_list[round_count, 0].append(result_table[i, 0])
					remove_list[round_count, 1].append(result_table[i, 1])
			#Update list
			for i in range(list_num):
				for j in range(len(remove_list[round_count, 0])):
					if (remove_list[round_count, 0][j] == list_table[i, 1][0]):
						list_table[i, 1].pop(0)
						whether_update = 1
						break
			#Print updated list
			print "Update list:"
			for i in range(list_num):
				print list_table[i, 1]
			#Check whether there are candidate pass half
			winner = ""
			for i in range(candidate_num):
				if(result_table[i, 2] > half_vote):
					winner = str(result_table[i, 1])
					pass_half = 1
			if(pass_half == 1):
				break
			round_count = round_count + 1
			#Check if not update list, then, no winner
			if(whether_update == 0):
				warning = "No candidate votes pass half"
				break

		print "The final winner: " + str(winner)
		return render_template('results.html', **locals())

	elif vote_method == 3:
		vote_method = "Weight"
		for i in range(candidate_num):
			result_table[i, 2] = db_func.count_candidate_total_point(vote_id, result_table[i, 0])

	elif vote_method == 4:
		vote_method = "Majority"
		for i in range(candidate_num):
			result_table[i, 2] = db_func.count_candidate_total_yes(vote_id, result_table[i, 0])
			print result_table[i, 2]

	# Method 1, 3, 4 will run this part
	most_vote = result_table[0, 2]
	for i in range(candidate_num):
		if (most_vote < result_table[i, 2]):
			most_vote = result_table[i, 2]
	winner = {}
	count_winner = 0
	for i in range(candidate_num):
		if (most_vote == result_table[i, 2]):
			winner[count_winner] = result_table[i, 1]
			count_winner = count_winner + 1

	return render_template('results.html', **locals())



@app.route("/create_vote", methods=["POST"])
def create_vote():

	vote_name = request.form['vote_name']
	expire_time = request.form['expire_time']
	vote_method = request.form['vote_method']
	secure_level = request.form['secure_level']
	# candidate_upload_type = request.form['candidate_upload_type']
	candidate_upload_text = request.form['candidate_upload_text']

	if (not vote_name):
		warning = "You need to set Vote Name."
		return render_template('setup.html', **locals())
	if (not expire_time):
		warning = "You need to set Expire Time."
		return render_template('setup.html', **locals())
	if (not candidate_upload_text):
		warning = "You need to type in Candidate List."
		return render_template('setup.html', **locals())

	vote_method = int(vote_method)
	candidate_upload_text = candidate_upload_text.split('\r\n')
	input_time = time.strptime(expire_time, "%d/%m/%Y %H:%M")
	expire_time = time.strftime("%Y-%m-%d %H:%M:%S", input_time)

	if 'user_id' in session:
		voter_upload_text = request.form['voter_upload_text']
		voter_upload_text = voter_upload_text.split('\r\n')
		voter_id_list = {}
		for i in range(len(voter_upload_text)):
			query = "SELECT * FROM user_info WHERE user_email='" + str(voter_upload_text[i]) + "'"
			results = db_func.execute_sql_select(query)
			if(len(results) == 1):
				voter_id_list[i] = results[0][0] #user id
			else:
				warning = "Sorry you have input unexisted user email."
				return render_template('notification.html', **locals())

		vote_id = db_func.create_vote(vote_name, expire_time, vote_method, candidate_upload_text, 2, voter_id_list, session['user_id'])
		
	else:
		voter_upload_text = ""
		creator_id = ""
		vote_id = db_func.create_vote(vote_name, expire_time, vote_method, candidate_upload_text, 1, voter_upload_text, creator_id)

	url_creator = socket.gethostbyname(socket.gethostname())

	temp = ":" + str(port_number) + "/view_result/" + str(vote_id)
	url_creator = url_creator + temp

	url_voter = socket.gethostbyname(socket.gethostname())
	temp = ":" + str(port_number) + "/cast_a_vote/" + str(vote_id)
	url_voter = url_voter + temp

	return render_template('setup_complete.html', **locals())


if __name__ == "__main__":
	app.debug = True
	# app.run()
	app.run(host="0.0.0.0",port=port_number)
