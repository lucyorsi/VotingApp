##How to test?

0. If you haven't create database yet: 
	(1). Enter mysql: mysql -u root -p
	(password is just 'password'...)
	(2). create database AnotherVote;
	(3). show databases;
	(then you should see AnotherVote been created)

1. in the folder flask: python app.py 
(currently we are using port: 4000, you can change the 'port_number' in app.py)

2. in your browser type url: 0.0.0.0:4000/init_database
(this will create all the tables and drop previous existed tables)
(it will redirect to /index.html)

##What we have...
0. Now we can only use partial functions in 'Casual system'(user don't need to login in)

1. Right now we can only click on 'Initiate a vote' or 'Vote' on /index.html

2. 'Initiate a vote' -> /setup (The page you can set up a new vote)

3. /setup In this page, user setup a new vote. -> /setup_complete

4. /cast_a_vote/<vote_id> Voter can use this to cast a vote (not done yet..)

5. /view_result/<vote_id> Creator can use this to view current results (can only support 'Single' vote method)

##About vote_method
1. Single: each voter can vote one candidate

2. Ranking: each voter provide a list and rank all candidates

3. Weight: each voter has 100 points and distribute the points among candidates

4. Majority: each voter choose 'Yes' or 'No' for each candidate

##Next stage:
1. support ranking, weight, majority in /view_result

2. support single, ranking, weight, majority in /cast_a_vote

3. /login, /register, /logout

4. /homepage (after login, user should be able to view all the votes created by him and all other votes he can join)

5. Many buttons' action haven't been set yet...

6. Live results. (Are we going to use Chart.js and websocket?)

##Cut some work: 
(If we can finish all basic functions above, then, we can work on the below functions)

1. support excel, .txt upload candidates list or voters list.

2. change password.