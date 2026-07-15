# 1. Node.js base image
FROM node:24

# 2. Container working directory
WORKDIR /app

# 3. Copy dependencies files to the working directory
COPY package*.json ./

# 4. Install dependencies
RUN npm install

# 5. Copy the rest of the application code to the working directory
COPY . .

# 6. Generate Prisma client
RUN npx prisma generate

# 7. Expose port 3000
EXPOSE 3000

# 8. Start the application
CMD ["npm", "start"]