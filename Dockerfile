FROM node:16
WORKDIR /app
COPY package.json /app/
COPY package-lock.json /app/
COPY tsconfig.json /app/
COPY src /app/src
COPY data /app/data
RUN apt update && apt install zip
RUN cd /app
RUN npm install
RUN npm run build
CMD npm run serve
