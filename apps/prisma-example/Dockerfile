FROM node:20
MAINTAINER David Banham <david@banham.id.au>

WORKDIR /usr/src/app

COPY ./package.json /usr/src/app/
COPY ./yarn.lock /usr/src/app/
RUN yarn

ADD . /usr/src/app/

EXPOSE 4000

CMD ["npm", "test"]
