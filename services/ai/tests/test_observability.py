from app.observability import AiMetrics, normalize_request_id


def test_request_id_normalization_preserves_safe_correlations() -> None:
    assert normalize_request_id("req-safe_123") == "req-safe_123"
    generated = normalize_request_id("bad request id with spaces")
    assert generated != "bad request id with spaces"
    assert len(generated) == 36


def test_ai_metrics_use_bounded_route_templates_and_prometheus_histograms() -> None:
    metrics = AiMetrics()
    metrics.begin()
    metrics.complete("POST", "/internal/recommendations/personalized", 200, 0.125)
    output = metrics.render_prometheus()
    assert "tradenest_ai_http_requests_total" in output
    assert 'route="/internal/recommendations/personalized"' in output
    assert 'status="200"' in output
    assert "tradenest_ai_http_request_duration_seconds_bucket" in output
    assert "tradenest_ai_http_requests_in_flight 0" in output
