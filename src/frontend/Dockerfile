# Use Node.js image as base
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json from the root
COPY package.json package-lock.json ./

# Install dependencies in the root directory
RUN npm install

# Copy frontend-specific files into the container
COPY frontend/ .



EXPOSE 3000
CMD ["node", "frontend.js"]
