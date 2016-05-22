FROM ubuntu

ENV MYSQL_USER=mysql \
    MYSQL_DATA_DIR=/var/lib/mysql \
    MYSQL_RUN_DIR=/run/mysqld \
    MYSQL_LOG_DIR=/var/log/mysql \
    DATABASE_PASS=password

RUN apt-get update
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server 

RUN apt-get install -y python3 python-pip libmysqlclient-dev python-mysqldb
RUN pip install flask flask-mysql flask-socketio flask-login eventlet

COPY ./setup_mysql.sh /tmp/setup_mysql.sh
RUN chmod 0700 /tmp/setup_mysql.sh
RUN /tmp/setup_mysql.sh

ENTRYPOINT ["/bin/bash"]
