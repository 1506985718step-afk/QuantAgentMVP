
# Stage 1: Build
FROM node:18-alpine as builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# Set API Base to relative path for Nginx proxying
ENV VITE_API_BASE=/api
# Default to Real Backend for Docker builds
ENV VITE_USE_REAL_BACKEND=true
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx Template
# Nginx image automatically substitutes vars in /etc/nginx/templates/*.template 
# and outputs to /etc/nginx/conf.d/default.conf
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Default env var (can be overridden in Zeabur)
ENV BACKEND_HOST=backend

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
