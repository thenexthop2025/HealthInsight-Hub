#!/bin/bash
set -e

echo "Starting application initialization..."

# Run database initialization
echo "Initializing database..."
python init_db.py

echo "Database initialization completed!"

# Start the application
echo "Starting uvicorn server..."
exec uvicorn main:app --host 0.0.0.0 --port 8000

