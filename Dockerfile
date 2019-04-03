FROM node:8.15.1-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY index.js ./
COPY ldap-config.json ./

RUN npm install

CMD [ "npm", "start" ]