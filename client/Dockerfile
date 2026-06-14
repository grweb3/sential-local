FROM node:20-bullseye-slim
WORKDIR /app

# Copy package files first for faster caching
COPY package*.json ./

# Install dependencies natively inside the Linux container (Lightning fast!)
RUN npm install --legacy-peer-deps

# Copy the rest of your frontend code
COPY . .

# Expose Vite's port
EXPOSE 5173

# Start the dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]