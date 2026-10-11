"""Executable HTTP contract tests for the internal, non-browser-facing FastAPI service."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_recommendation_request_rejects_unapproved_model_controls() -> None:
    response = client.post('/internal/recommendations/personalized', json={
        'events': [], 'products': [], 'limit': 5, 'categoryWeight': 0.9,
    })
    assert response.status_code == 422


def test_recommendation_cold_start_returns_valid_empty_response() -> None:
    response = client.post('/internal/recommendations/personalized', json={
        'events': [], 'products': [], 'limit': 5,
    })
    assert response.status_code == 200
    assert response.json()['items'] == []
    assert response.json()['modelVersion'].startswith('recommendation-')


def test_internal_fraud_risk_is_advisory_and_does_not_mutate_payments() -> None:
    response = client.post('/internal/fraud/score', json={
        'payment': {'amount': '500.00', 'currency': 'USD', 'outcome': 'FAILED'},
        'signals': {
            'failedPayments24h': 6, 'paymentAttempts1h': 9,
            'paymentAttempts24h': 17, 'priorSucceededPayments': 0,
            'distinctIpAddresses24h': 6, 'distinctUserAgents24h': 6,
            'marketP95Amount': '400.00',
        },
    })
    assert response.status_code == 200
    data = response.json()
    assert data['riskLevel'] == 'HIGH'
    assert data['reviewRecommended'] is True
    assert 'paymentStatus' not in data
    assert 'blockBuyer' not in data


def test_smart_pricing_rejects_invalid_financial_context() -> None:
    response = client.post('/internal/pricing/suggest', json={
        'product': {
            'productId': '10000000-0000-4000-8000-000000000001',
            'sellerId': '10000000-0000-4000-8000-000000000002',
            'categoryId': '10000000-0000-4000-8000-000000000003',
            'currentPrice': '-5.00', 'currency': 'USD',
        },
        'comparables': [],
        'signals': {'productViews': 0, 'addToCartEvents': 0, 'completedOrders': 0, 'completedUnitsSold': 0},
    })
    assert response.status_code == 422
