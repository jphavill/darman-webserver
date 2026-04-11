# syntax=docker/dockerfile:1.7
FROM python:3.11-slim

ARG BACKEND_SOURCE_HASH=unknown
LABEL com.exercise.backend-source-hash=$BACKEND_SOURCE_HASH

WORKDIR /app

COPY requirements.txt ./
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --disable-pip-version-check -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
