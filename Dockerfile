FROM node:14-alpine

RUN mkdir /analyzer-dummy
# Create app directory
WORKDIR /analyzer-dummy

COPY ./package*.json ./

RUN npm install

# Bundle app source
COPY . .
EXPOSE 3000

CMD [ "npm", "start" ]