# all the imports
import os
from flask import Flask, render_template, url_for, request, session, g, redirect, abort, flash
from flask.ext.mysql import MySQL
import db_func
import time
import socket

app = Flask(__name__)

port_number = 4000

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



@app.route("/cast_a_vote/<vote_id>")
def cast_a_vote(vote_id):
	results = db_func.check_vote_method(vote_id)

	# Check whether vote_id exists
	if (results == 0):
		warning = "Sorry, the vote does not exist."
		return render_template('sorry.html', **locals())
	else:
		vote_name = results[1]
		expire_time = results[3]
		vote_method = results[4]

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
	if (vote_method == 1):
		candidate_id = int(request.form['input_candidate'])
		db_func.cast_single_vote(vote_id, candidate_id)

	elif (vote_method == 3):
		candidate_num = int(request.form['candidate_num'])
		results = db_func.get_candidate_list(vote_id)
		candidate_list = {}
		i = 0
		for row in results:
			candidate_list[i, 0] = row[2] #candidate name
			candidate_list[i, 1] = row[0] #candidate id
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
		candidate_num = int(request.form['candidate_num'])
		results = db_func.get_candidate_list(vote_id)
		candidate_list = {}
		i = 0
		for row in results:
			candidate_list[i, 0] = row[2] #candidate name
			candidate_list[i, 1] = row[0] #candidate id
			candidate_list[i, 2] = request.form[str(candidate_list[i, 1])] #candidate yes_no value
			i = i + 1
		# Insert to database
		for i in range(candidate_num):
			db_func.cast_majority_vote(vote_id, candidate_list[i, 1], candidate_list[i, 2])


	return render_template('thanks.html', **locals())




@app.route("/view_result/<vote_id>")
def view_result(vote_id):
	results = db_func.check_vote_method(vote_id)

	# Check whether vote_id exists
	if (results == 0):
		warning = "Sorry, the vote does not exist."
		return render_template('sorry.html', **locals())
	else:
		vote_name = results[1]
		expire_time = results[3]
		vote_method = results[4]

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

	elif vote_method == 3:
		vote_method = "Weight"
		for i in range(candidate_num):
			result_table[i, 2] = db_func.count_candidate_total_point(vote_id, result_table[i, 0])

	elif vote_method == 4:
		vote_method = "Majority"
		for i in range(candidate_num):
			result_table[i, 2] = db_func.count_candidate_total_yes(vote_id, result_table[i, 0])
			print result_table[i, 2]

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
	if 'user_id' in session:
		return render_template('setup_compelete.html')
	else:
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

		vote_id = db_func.create_vote(vote_name, expire_time, vote_method, candidate_upload_text)

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
