#!/bin/bash
set -e

CONTAINER_NAME="hermy-hq-db"
DB_USER="postgres"
DB_PASS="Yehhimrich@01"
DB_NAME="hermyhq"
PORT="5432"

echo "1. Checking/Stopping existing Postgres container..."
docker rm -f $CONTAINER_NAME 2>/dev/null || true

echo "2. Starting Postgres container..."
docker run -d \
  --name $CONTAINER_NAME \
  -p 5432:5432 \
  -e POSTGRES_USER=$DB_USER \
  -e POSTGRES_PASSWORD=$DB_PASS \
  -e POSTGRES_DB=$DB_NAME \
  postgres:17-alpine

echo "3. Waiting for Postgres to be ready..."
until docker exec $CONTAINER_NAME pg_isready -U $DB_USER -d $DB_NAME >/dev/null 2>&1; do
  echo "Waiting..."
  sleep 2
done

echo "4. Pushing Prisma schema to local database..."
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:${PORT}/${DB_NAME}"
export POSTGRES_URL=$DATABASE_URL
npx prisma db push

echo "5. Building App container..."
docker build -t hermy-hq-app .

echo "6. Stopping existing App container..."
docker rm -f hermy-hq-app 2>/dev/null || true

echo "7. Starting App container..."
docker run -d \
  --name hermy-hq-app \
  --net=host \
  -e DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:${PORT}/${DB_NAME}" \
  -e POSTGRES_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:${PORT}/${DB_NAME}" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -e NEXTAUTH_SECRET="3avQ-JhO-JAY5S7aQVWX8-Ja27gysSjyBH9y-6GrhgQ" \
  -e GOOGLE_CLIENT_ID="placeholder-add-google-client-id" \
  -e GOOGLE_CLIENT_SECRET="placeholder-add-google-secret" \
  -e ALLOWED_EMAILS="keshav321sharma.ks@gmail.com" \
  -e NEXT_PUBLIC_OWNER_NAME="Keshav Sharma" \
  -e NEXT_PUBLIC_BASE_URL="http://localhost:3000" \
  -e HERMES_BOARD="default" \
  -e INTERNAL_API_SECRET="bf1ab9512c1eb4187325d4ad1ee1233952b0df516309c9cf8a7853d6e442870" \
  -e CRON_SECRET="50527f0a1291e95028278383018eee43446f37a7d9ea4f20724625beaf48059a" \
  hermy-hq-app

echo "Done! Hermy HQ is running on http://localhost:3000"
