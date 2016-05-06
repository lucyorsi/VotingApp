FROM ubuntu

ENV MYSQL_USER=mysql \
    MYSQL_DATA_DIR=/var/lib/mysql \
    MYSQL_RUN_DIR=/run/mysqld \
    MYSQL_LOG_DIR=/var/log/mysql

RUN apt-get update
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server && \
    rm -rf ${MYSQL_DATA_DIR}
#    rm -rf /var/lib/apt/lists/*

RUN apt-get install -y python3 python-pip libmysqlclient-dev python-mysqldb
RUN pip install flask
RUN pip install flask-mysql
RUN pip install flask-socketio

COPY ./setup_mysql.sh /tmp/setup_mysql.sh
RUN chmod 0700 /tmp/setup_mysql.sh
RUN /tmp/setup_mysql.sh

VOLUME ["/data"]
ENTRYPOINT ["/bin/bash"]
