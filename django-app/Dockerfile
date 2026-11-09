FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
RUN mkdir -p /app/data
CMD ["sh", "-c", "python manage.py migrate --run-syncdb && python manage.py seed_data && python manage.py runserver 0.0.0.0:8000"]
