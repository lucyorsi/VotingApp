# all the imports
import os
import functools
from flask import Flask, render_template, url_for, request, session, g, redirect, abort, flash
from flask.ext.mysql import MySQL
from flask.ext.socketio import * #SocketIO, send, join_room
import db_func
import time
import datetime
import socket
from binascii import hexlify
import flask.ext.login as flask_login
from flask_login import current_user, login_user
from flask_socketio import join_room, leave_room, rooms  #disconnect

app = Flask(__name__)

app.secret_key = "igroup-4140proj"

port_number = 5000

login_manager = flask_login.LoginManager()
login_manager.init_app(app)

users = {}

def authenticated_only(f):
    @functools.wraps(f)
    def wrapped(*args, **kwargs):
        if not current_user.is_authenticated:
            print "not authed"
            return redirect("/")
        else:
            return f(*args, **kwargs)
    return wrapped

@login_manager.user_loader
def load_user(user_id):
    user_id = str(user_id)
    if user_id in users:
        return users[user_id]
    else:
        print "could not load user"
        print users
        print user_id
        return None

class User:
    def __init__(self, user_name, user_id, unique_id):
        self.user_name = user_name
        self.user_id = user_id
        self.unique_id = unique_id

        self.is_authenticated = False
        self.is_active = False
        self.is_anonymous = False

        self.authed_elections = {}
        
    def get_id():
        print "get_id", self.user_id
        return unicode(self.unique_id)

@app.route("/init_database")
def init_database():
    db_func.create_database()
    return render_template('index.html')

@app.route("/")
def main():
    return render_template('index.html')

@app.route("/setup")
def setup():
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

        user_name = results[0][1]
        user_id = results[0][0]
        user_key = results[0][4]

        session['user_name'] = user_name
        session['user_id'] = user_id

        new_user = User(user_name, user_id, str(user_key))
        new_user.is_authenticated = True
        login_user(new_user)

        users[str(user_id)] = new_user
        print "after adding new_user", users

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
@authenticated_only
def home():
    user_id = str(current_user.user_id)
    query = "SELECT * FROM votes_info WHERE creator_id='" + user_id + "'"
    initiated_votes = db_func.execute_sql_select(query)
    query = "SELECT vote_id FROM qualified_voters WHERE voter_id='" + user_id + "'"
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

    if ('user_id' in session):
	    query = "UPDATE qualified_voters SET already_vote=1 WHERE voter_id='" + str(session['user_id']) + "' AND vote_id='" + str(vote_id) + "'" 
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
        secure_level = request.form['secure_level']
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

        vote_id = db_func.create_vote(vote_name, expire_time, vote_method, candidate_upload_text, secure_level, voter_id_list, session['user_id'])
        
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



@app.route("/crypto_elections")
@app.route("/crypto_elections/<election_id>")
@authenticated_only
def crypto_election(election_id = None):
    if not election_id:
        # bad link
        return redirect("/")

    else:
        # they have logged
        query = "SELECT vote_id FROM qualified_voters WHERE voter_id=" + str(current_user.user_id)
        results = db_func.execute_sql_select(query)
        
        if (int(election_id),) not in results:
            print "user not authed for election"
            print results
            print election_id
            return redirect("/")

        else:
            current_user.authed_elections[election_id] = True

            results = db_func.check_vote_method(election_id)

            print "RESULTS", results

            vote_id = results[0]
            vote_name = results[1]
            expire_time = results[3]
            vote_method = results[4]
            # Check whether vote has expired
            current_time = datetime.datetime.strftime(datetime.datetime.now(), "%Y-%m-%d %H:%M:%S")
            if datetime.datetime.strftime(expire_time, "%Y-%m-%d %H:%M:%S") < current_time:
                warning = "Sorry, the vote has already ended."
                return render_template('notification.html', **locals())

            print "VOTE_ID", vote_id
  

            candidate_rows = db_func.get_candidate_list(str(vote_id))
            candidate_num = len(candidate_rows)
            candidate_list = [row[2] for row in sorted(candidate_rows)]
            
            return render_template("crypto_" + "single" + ".html", **locals()) # TODO: "single" to the vote_method. not working now becuase vote_method is an int, need to ask Yang/Jacky

#### WEBSOCKET FUNCTIONS ####
socketio = SocketIO(app)


@socketio.on("connect")
def connect():
    print "socketio connection"

@socketio.on("join_election")
@authenticated_only
def join_election(election_id):
    election_id = str(election_id)
    print "USER AUTHED ELECTIONS", current_user.authed_elections
    if election_id in current_user.authed_elections and current_user.authed_elections[election_id]:
        join_room(election_id)
        unique_id_table = db_func.get_qualified_voters(election_id)
        emit("unique_id_table", unique_id_table)

    else:
        emit("auth_failed")


public_key_shares = {}

@socketio.on("public_key_share")
@authenticated_only
def public_key_share(election_id, key_share):
    election_id = str(election_id)
    key_share = str(key_share)

    print "PUBLIC KEY SHARE"
    print election_id
    print key_share

    if election_id in current_user.authed_elections and current_user.authed_elections[election_id]:
        emit("public_key_share", {"unique_id": current_user.unique_id, "key_share": key_share}, room = election_id)

        # insert share into DB
        public_key_shares[current_user.unique_id] = key_share

    else:
        emit("auth_failed")

def authed_for_election(f):
    @functools.wraps(f)
    def wrapped(*args, **kwargs):
        if not (str(*args[0]) in current_user.authed_elections and current_user.authed_elections[str(*args[0])]):
            print "not authed"
            emit("auth_failed")
        else:
            return f(*args, **kwargs)
    return wrapped

@socketio.on("request_public_key_share")
@authenticated_only
@authed_for_election
def request_public_key_share(election_id, unique_id):
    election_id = str(election_id)
    unique_id = str(unique_id)
    
    print public_key_shares
    print unique_id

    if unique_id in public_key_shares:
        emit("public_key_share", {"unique_id": unique_id, "key_share": public_key_shares[unique_id]})

    else:
        emit("unrecognized_unique_id")

proofs = {}
@socketio.on("send_proof")
@authenticated_only
@authed_for_election
def send_proof(election_id, proof_type, proof):
    election_id = str(election_id)
    proof_type = str(proof_type)
    proof = str(proof)

    # add proof to DB
    proofs[(current_user.unique_id, proof_type)] = proof

    emit("proof", {"proof_type": proof_type, "proof": proof}, room = election_id)


@socketio.on("request_proof")
@authenticated_only
@authed_for_election
def request_proof(election_id, proof_type, unique_id):
    election_id = str(election_id)
    unique_id = str(unique_id)
    proof_type = str(proof_type)

    if (unique_id, proof_type) in proofs:
        emit("proof", {"proof_type": proof_type, "proof": proofs[(unique_id, proof_type)]})

    else:
        emit("unproved")

final_talies = {}
@socketio.on("final_tally")
@authenticated_only
@authed_for_election
def final_tally(election_id, tally):
    election_id = str(election_id)
    tally = str(tally)

    final_talies[current_user.unique_id] = tally

    # if len(final_tallies) == n: check all the same

if __name__ == "__main__":
    app.debug = True
    # app.run()
    #app.run(host="0.0.0.0",port=port_number)
    socketio.run(app, host = "0.0.0.0")
