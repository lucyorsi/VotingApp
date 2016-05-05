# all the imports
import os
from flask import Flask, render_template, url_for, request, session, g, redirect, abort, flash
from flask.ext.mysql import MySQL
import db_func

app = Flask(__name__)


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

@app.route("/setup_compelete")
def setup_compelete():

	return render_template('setup_compelete.html')

@app.route("/create_vote", methods=["POST"])
def create_vote():
	if 'user_id' in session:
		return render_template('setup_compelete.html')
	else:
		vote_name = request.form['vote_name']
		expire_time = request.form['expire_time']
		vote_method = request.form['vote_method']
		secure_level = request.form['secure_level']
		candidate_upload_type = request.form['candidate_upload_type']
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


		print vote_name
		print expire_time
		print vote_method
		print secure_level
		print candidate_upload_type
		print candidate_upload_text
		# print request.form
		# print request.data

		return render_template('setup_complete.html', **locals())


if __name__ == "__main__":
	app.debug = True
	# app.run()
	app.run(host="0.0.0.0",port=4000)
