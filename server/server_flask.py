from flask import Flask, render_template
from flask_socketio import SocketIO, send, emit, join_room, leave_room
from random import randint
import json

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

public_key_shares = {} 
fake_p_id = 0
users = {}

#number_of_voters = get_num_voters()
unique_id_table = []

class User:
    def __init__(self, p_id, users_dict):
        self.p_id = p_id
        self.unique_id = unique_id_table[p_id]
        self.is_authenticated = False
        self.is_active = False

        users_dict[self.unique_id] = self


#login_manager = LoginManager()

# your code

#login_manager.init_app(app)

#@login_manager.user_loader
def load_user(unique_id):
    return users[unique_id]

@app.route('/')
def index():
   return render_template('index.html')

@socketio.on('connect')
def connect_handler():
   print("websocket opened")
   p_id = 0
   authenticated = False
  
@socketio.on('validate_client')
def handle_validate_client(given_session_id):
       print "here"
       if check_id(given_session_id):
           p_id = get_id_from_session(given_session_id) 
           authenticated = True
           print "working"
       else:
           socket.emit('bad_id')
   
def check_id(session_id):
   #TODO check if session_id is in database   
   return True

def get_id_from_session(session_id):
    #TODO get p_id associated with session id from database
    return given_session_id
 
@socketio.on('publish_public_key_share')
def handle_publish_public_key_share(public_key_share):
   print "public key share received"
   global fake_p_id 
   public_key_shares[fake_p_id] = public_key_share

   #Uses broadcast function now, should change to 
   #emit(public_key_share_submitted, p_id, value, room=room)
   #when session management is set up
   emit('public_key_share_received', (fake_p_id,public_key_share), broadcast=True) 
   fake_p_id += 1

@socketio.on('publish_encrypted_vote')
def handle_publish_encrypted_vote(commits):
   #parsed_commits = json.loads(commits)

   emit('encrypted_vote_received', commits, broadcast=True)

@socketio.on('message')
def handle_message(message):
   print message 

#@socketio.on
if __name__ == '__main__':
   socketio.run(app, host='0.0.0.0', port=5000)


