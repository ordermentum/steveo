FROM ordermentum/service:15
MAINTAINER Ordermentum <engineering@ordermentum.com>

COPY ./package.json /usr/src/app
COPY ./yarn.lock /usr/src/app
RUN yarn

ADD . /usr/src/app

EXPOSE 4141

