FROM python:3.12-slim

WORKDIR /app
COPY index.html manus-routes.json ./
COPY public ./public

ENV PYTHONUNBUFFERED=1
EXPOSE 3000

CMD ["sh", "-c", "exec python3 -m http.server ${PORT:-3000} --bind 0.0.0.0"]
