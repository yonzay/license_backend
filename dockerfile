FROM node:latest

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY /build .

EXPOSE 8080
CMD [ "node", "server.js" ]
