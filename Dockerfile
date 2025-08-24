# Use Ubuntu as base image for better language support
FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js and programming languages
RUN apt-get update && apt-get install -y \
    curl \
    nodejs \
    npm \
    python3 \
    python3-pip \
    openjdk-17-jdk \
    gcc \
    g++ \
    make \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy app source
COPY . .

# Create public directory if it doesn't exist
RUN mkdir -p public

# Copy frontend files to public directory
COPY index.html public/

# Create temp directory for code execution
RUN mkdir -p temp

# Expose port
EXPOSE 3000

# Add non-root user for security
RUN adduser --disabled-password --gecos '' appuser && \
    chown -R appuser:appuser /usr/src/app
USER appuser

# Start the application
CMD ["npm", "start"]