# all the imports
import os
from sqlite3 import dbapi2 as sqlite3
from flask import Flask, render_template, url_for, request, session, g, redirect, abort, flash
from contextlib import closing

app = Flask(__name__)

# Load default config and override config from an environment variable
app.config.update(dict(
    DATABASE=os.path.join(app.root_path, 'vote.db'),
    DEBUG=True,
    SECRET_KEY='development key',
    USERNAME='admin',
    PASSWORD='default'
))
app.config.from_envvar('FLASKR_SETTINGS', silent=True)

def connect_db():
    return sqlite3.connect(app.config['DATABASE'])

def init_db():
    with closing(connect_db()) as db:
        with app.open_resource('init.sql', mode='r') as f:
            db.cursor().executescript(f.read())
        db.commit()

@app.before_request
def before_request():
    g.db = connect_db()

@app.teardown_request
def teardown_request(exception):
    db = getattr(g, 'db', None)
    if db is not None:
        db.close()

@app.route("/")
def main():
	return render_template('index.html')

@app.route("/setup")
def setup():
    return render_template('setup.html')

@app.route("/setup_compelete")
def setup_compelete():
    return render_template('setup_compelete.html')

@app.route("/results/<int:vote_id>")
def show_results(vote_id):
	return "hello"
	#return render_template('results.html', vote_id=vote_id);

@app.route("/results/<int:vote_id>", methods=["POST", "GET"])
def results(vote_id):
	return vote_id

if __name__ == "__main__":
	app.debug = True
	app.run()