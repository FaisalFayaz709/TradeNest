# syntax=docker/dockerfile:1.7
FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    AI_SERVICE_HOST=0.0.0.0 \
    AI_SERVICE_PORT=8000

RUN groupadd --system tradenest \
    && useradd --system --gid tradenest --home-dir /app --create-home tradenest

WORKDIR /app
COPY services/ai/pyproject.toml services/ai/requirements.lock ./
COPY services/ai/app ./app
RUN python -m pip install --no-cache-dir -r requirements.lock \
    && python -m pip install --no-cache-dir --no-deps --no-build-isolation . \
    && chown -R tradenest:tradenest /app

USER tradenest
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 \
  CMD python -c "import urllib.request; r=urllib.request.urlopen('http://127.0.0.1:8000/health/ready', timeout=3); raise SystemExit(0 if r.status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
