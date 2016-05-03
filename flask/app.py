# all the imports
import os
from flask import Flask, render_template, url_for, request, session, g, redirect, abort, flash
    
# from flask.ext.mysql import MySQL

app = Flask(__name__)

# mysql = MySQL()

# # MySQL configurations
# app.config['MYSQL_DATABASE_USER'] = 'admin'
# app.config['MYSQL_DATABASE_PASSWORD'] = 'csci4140'
# app.config['MYSQL_DATABASE_DB'] = 'AnotherVote'
# app.config['MYSQL_DATABASE_HOST'] = 'localhost'
# mysql.init_app(app)

# conn = mysql.connect()
# cursor = conn.cursor()
# cursor.execute('''create table setup_vote (
#   voteID integer primary key autoincrement,
#   name text not null,
#   expire_date date not null,
#   expire_time time not null,
#   vote_method integer not null,
#   candidates_upload_method integer not null,
#   candidates_input text not null,
#   voters_upload_method integer not null,
#   voters_input text not null
# );''')
# conn.commit()
# cursor.execute('''select * from setup_vote''')
# data = cursor.fetchall()
# print data

@app.route("/")
def main():
    return render_template('index.html')

@app.route("/setup")
def setup():
    return render_template('setup.html')

@app.route("/setup_compelete")
def setup_compelete():
    return render_template('setup_compelete.html')

# @app.route("/v1_setup", methods=["POST", "GET"])
# def results(vote_id):

#   return 

if __name__ == "__main__":
    app.debug = True
    app.run(host='0.0.0.0', port=80)