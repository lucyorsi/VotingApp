# AnotherVote
It's Just Another Voting App™. Allows people to host votes using several different voting schemes as well as three different levels of security.

## Installation
First, clone the repo:
```
$ cd /path/for/repo
$ git clone https://github.com/cuhk-csci4140/project-igroup.git
$ cd project-igroup
```

### Using Docker
We have provided a Dockerfile which sets everything up. It sets up MySQL with a default password of "password", but you can change this by editing line 7 of the Dockerfile at `server/Dockerfile`.
```
  DATABASE_PASS=yourpasswordhere
```

Build the docker image:
```
$ cd server
# docker build -t igroup-voting-server .
```

Run the docker image with something like:
```
# docker run --name voting-server -it -d -p 80:5000 -v /path/for/repo:/data igroup-voting-server
```
You can change `80` if you want to run the server on a non-standard port.

Go into the docker container and start up the server:
```
# docker attach voting-server
root@[CONTAINER ID]:/# service mysql start
root@[CONTAINER ID]:/# cd /data/project-igroup/flask
root@[CONTAINER ID]:/# python app.py
```

Finally navigate to `localhost` in your browser and you should see homepage. (if you entered a different port than `80` in the `docker run` command, go to `localhost:port`)

### Avoiding Docker

You will need to install the following packages on your system: `mysql`, `python2`, `pip2`, `libmysqlclient`, and `python-mysqldb`.

For example, on Ubuntu, you can do:
```
# apt-get install mysql-server python python-pip libmysqlclient-dev python-mysqldb
```

Then install the needed Python packages with pip:
```
# pip install flask flask-mysql flask-socketio flask-login eventlet
```

Make sure the mysql server is started (`# service mysql start` on Ubuntu) and enter a MySQL session:
```
# mysql -u root -p
[enter your password]
> create database AnotherVote;
> exit;
```

Then set the environment variable `DATABASE_PASS` to your MySQL root password, and run:
```
$ cd flask
# python app.py
```

If you don't want to set the environment variable, you can just do
```
$ cd flask
# DATABASE_PASS=yourmysqlrootpass python app.py
```

You should then be able to navigate to `localhost:5000` in your browser and see the site.

## Crypto stuff

### Contribute
Install TypeScript:
```
$ npm install -g typescript
```

Make your changes in `crypto/vote.ts`. Then do:
```
$ cd crypto
$ tsc vote.ts
```

This will compile the TypeScript into JS and replace the file `vote.js`.

### Useful links
Heavily based on this paper: [A Secure and Optimally Efficient Multi-Authority Election Scheme](http://www.win.tue.nl/~berry/papers/euro97.pdf).

Also borrowing a bit from this paper: [Electronic Voting Schemes](http://bezadis.ics.upjs.sk/old/files/other/rjaskova.pdf).

Added help from [this Crypto SE answer](http://crypto.stackexchange.com/questions/3474/approach-towards-anonymous-e-voting/3554#3554).

[Lots of type definitions for TypeScript](https://github.com/DefinitelyTyped/DefinitelyTyped)

[The BigInteger library I started using](https://github.com/peterolson/BigInteger.js)

### Technique
The first layer is a set of JS crypto functions which do the heavy lifting for the math of the crypto. These functions depend on BigInteger.js, a library which allows us to use arbitrary size integers. They also depend on jssha256.js, which allows us to compute the SHA256 hash of a hex number. This hash is used for the "challenge" in zero knowledge proofs. Instead of each voter first sending out a commit, then receiving a challenge, and finally submitting their proof, they instead just do `sha256( unique_id | commit)` and use the output as their challenge. This allows voters to do "proofs" in a non-interactive way, greatly reducing complexity and network costs. Because voters have no control over their `unique_id`, unless they can do something sneaky like find collisions in SHA2, this makes this process the same as a random challenge (and simultaneously defeats the malicious verifier).

These crypto JS functions are then placed in a web worker. The web worker is then called from another script which uses socket.io to communicate with the server. The web worker is needed because otherwise the entire page will freeze when we do the crypto, which is quite CPU intensive.

The second layer, which has the socket.io functions, communicates with both the web worker and the server to coordinate the vote.
