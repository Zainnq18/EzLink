# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory to the root of your project inside the container
WORKDIR /app

# Copy requirements from the root
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy everything (including the 'app', 'static', and 'templates' folders)
COPY . .

# Expose FastAPI port
EXPOSE 8000

# FIX: Tell uvicorn to look inside the 'app' folder for the 'main' module
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
