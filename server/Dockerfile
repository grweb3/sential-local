# Use an explicit, stable Node + Python base image (UPDATED TO NODE 20)
FROM nikolaik/python-nodejs:python3.10-nodejs20-bullseye

# Install system dependencies required by Foundry
RUN apt-get update && apt-get install -y \
    curl \
    git \
    make \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Foundry toolchain
RUN curl -L https://foundry.paradigm.xyz | bash

# Explicitly map Foundry binaries to the system PATH
ENV PATH="/root/.foundry/bin:${PATH}"

# Run foundryup to download forge, cast, anvil
RUN foundryup

# Set the working directory for Sential Backend
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install Node modules
RUN npm install

# Install Python modules for the AST Chunker
RUN pip install tree-sitter tree-sitter-solidity

# Copy the rest of the server code
COPY . .

# Expose the port
EXPOSE 3001

# Command to spin up the secure engine
CMD ["npm", "run", "dev"]