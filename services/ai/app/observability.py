from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
import re
import sys
from threading import Lock
from time import perf_counter
from typing import Awaitable, Callable
from uuid import uuid4

from fastapi import Request, Response

REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$")
DURATION_BUCKETS_SECONDS = (0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)


def normalize_request_id(value: str | None) -> str:
    candidate = (value or "").strip()
    if REQUEST_ID_PATTERN.fullmatch(candidate):
        return candidate
    return str(uuid4())


@dataclass
class Histogram:
    count: int = 0
    sum_seconds: float = 0.0
    buckets: list[int] = field(default_factory=lambda: [0] * len(DURATION_BUCKETS_SECONDS))


class AiMetrics:
    def __init__(self) -> None:
        self._lock = Lock()
        self._in_flight = 0
        self._series: dict[tuple[str, str, int], Histogram] = {}

    def begin(self) -> None:
        with self._lock:
            self._in_flight += 1

    def complete(self, method: str, route: str, status_code: int, duration_seconds: float) -> None:
        method_label = self._label(method, "UNKNOWN", 16)
        route_label = self._label(route, "unmatched", 160)
        status = status_code if 100 <= status_code <= 599 else 500
        duration = max(0.0, duration_seconds)
        key = (method_label, route_label, status)
        with self._lock:
            self._in_flight = max(0, self._in_flight - 1)
            histogram = self._series.setdefault(key, Histogram())
            histogram.count += 1
            histogram.sum_seconds += duration
            for index, upper_bound in enumerate(DURATION_BUCKETS_SECONDS):
                if duration <= upper_bound:
                    histogram.buckets[index] += 1

    def render_prometheus(self) -> str:
        with self._lock:
            in_flight = self._in_flight
            series = [
                (key, Histogram(value.count, value.sum_seconds, list(value.buckets)))
                for key, value in self._series.items()
            ]

        lines = [
            "# HELP tradenest_ai_http_requests_in_flight Current in-flight TradeNest AI requests.",
            "# TYPE tradenest_ai_http_requests_in_flight gauge",
            f"tradenest_ai_http_requests_in_flight {in_flight}",
            "# HELP tradenest_ai_http_requests_total Completed TradeNest AI requests.",
            "# TYPE tradenest_ai_http_requests_total counter",
        ]
        for (method, route, status), histogram in series:
            labels = f'method="{self._escape(method)}",route="{self._escape(route)}",status="{status}"'
            lines.append(f"tradenest_ai_http_requests_total{{{labels}}} {histogram.count}")

        lines.extend(
            [
                "# HELP tradenest_ai_http_request_duration_seconds TradeNest AI request duration.",
                "# TYPE tradenest_ai_http_request_duration_seconds histogram",
            ]
        )
        for (method, route, status), histogram in series:
            labels = f'method="{self._escape(method)}",route="{self._escape(route)}",status="{status}"'
            for index, upper_bound in enumerate(DURATION_BUCKETS_SECONDS):
                lines.append(
                    f'tradenest_ai_http_request_duration_seconds_bucket{{{labels},le="{upper_bound}"}} '
                    f"{histogram.buckets[index]}"
                )
            lines.append(
                f'tradenest_ai_http_request_duration_seconds_bucket{{{labels},le="+Inf"}} {histogram.count}'
            )
            lines.append(
                f"tradenest_ai_http_request_duration_seconds_sum{{{labels}}} {histogram.sum_seconds}"
            )
            lines.append(
                f"tradenest_ai_http_request_duration_seconds_count{{{labels}}} {histogram.count}"
            )
        return "\n".join(lines) + "\n"

    def _label(self, value: str, fallback: str, max_length: int) -> str:
        normalized = re.sub(r"[^A-Za-z0-9_.:/-]", "_", str(value).strip())
        return (normalized[:max_length] or fallback)

    def _escape(self, value: str) -> str:
        return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


metrics = AiMetrics()


def _route_template(request: Request) -> str:
    route = request.scope.get("route")
    path = getattr(route, "path", None)
    return str(path) if path else "unmatched"


def _write_log(level: str, event: str, **fields: object) -> None:
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "service": "tradenest-ai",
        "event": event,
        **{key: value for key, value in fields.items() if value is not None},
    }
    stream = sys.stderr if level == "error" else sys.stdout
    stream.write(json.dumps(record, separators=(",", ":"), default=str) + "\n")
    stream.flush()


async def observe_http_request(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    request_id = normalize_request_id(request.headers.get("x-request-id"))
    request.state.request_id = request_id
    metrics.begin()
    started_at = perf_counter()
    status_code = 500

    try:
        response = await call_next(request)
        status_code = response.status_code
        response.headers["x-request-id"] = request_id
        return response
    except Exception as error:
        duration = max(0.0, perf_counter() - started_at)
        route = _route_template(request)
        metrics.complete(request.method, route, 500, duration)
        _write_log(
            "error",
            "http.request.completed",
            requestId=request_id,
            method=request.method,
            route=route,
            statusCode=500,
            durationMs=round(duration * 1000, 3),
            errorType=type(error).__name__,
        )
        raise
    finally:
        if status_code != 500 or "response" in locals():
            duration = max(0.0, perf_counter() - started_at)
            route = _route_template(request)
            metrics.complete(request.method, route, status_code, duration)
            level = "warn" if status_code >= 400 or duration >= 1.0 else "info"
            _write_log(
                level,
                "http.request.completed",
                requestId=request_id,
                method=request.method,
                route=route,
                statusCode=status_code,
                durationMs=round(duration * 1000, 3),
            )
