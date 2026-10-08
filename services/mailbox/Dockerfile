FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
ENV PORT=8787 HOST=0.0.0.0 DATA_DIR=/data
VOLUME /data
EXPOSE 8787
USER node
CMD ["node", "src/cli.mjs"]
