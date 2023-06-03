FROM node:14-alpine

RUN mkdir /wcec-api-analyzer
# Create app directory
WORKDIR /wcec-api-analyzer

COPY ./package*.json ./

RUN npm install

# Bundle app source
COPY . .
EXPOSE 3000

CMD [ "npm", "start" ]