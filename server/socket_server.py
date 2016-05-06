from random import randint

users = {}

number_of_voters = get_num_voters()
# generate unique id table
unique_id_table = []

class User:
    def __init__(self, p_id, users_dict):
        self.p_id = p_id
        self.unique_id = unique_id_table[p_id]
        self.is_authenticated = False
        self.is_active = False

        users_dict[self.unique_id] = self


login_manager = LoginManager()

# your code

login_manager.init_app(app)

@login_manager.user_loader
def load_user(unique_id):
    return users[unique_id]



