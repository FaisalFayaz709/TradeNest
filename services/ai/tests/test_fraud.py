from app.fraud import FraudPayment, FraudRiskRequest, FraudSignals, fraud_risk_score


def request(**overrides):
    signals = {
        "failedPayments24h": 0,
        "paymentAttempts1h": 1,
        "paymentAttempts24h": 1,
        "priorSucceededPayments": 2,
        "distinctIpAddresses24h": 1,
        "distinctUserAgents24h": 1,
        "marketP95Amount": "500.00",
    }
    signals.update(overrides)
    return FraudRiskRequest(
        payment=FraudPayment(amount="100.00", currency="USD", outcome="SUCCEEDED"),
        signals=FraudSignals(**signals),
    )


def test_low_risk_has_no_review_recommendation():
    result = fraud_risk_score(request())
    assert result.riskLevel == "LOW"
    assert result.reviewRecommended is False
    assert result.riskScore == 0.0


def test_repeated_failures_create_medium_risk():
    result = fraud_risk_score(request(failedPayments24h=3))
    assert result.riskLevel == "MEDIUM"
    assert result.reviewRecommended is False
    assert any(reason.code == "REPEATED_PAYMENT_FAILURES" for reason in result.reasons)


def test_combined_signals_create_high_review_risk():
    req = request(
        failedPayments24h=3,
        paymentAttempts1h=6,
        priorSucceededPayments=0,
        distinctIpAddresses24h=5,
        distinctUserAgents24h=5,
        marketP95Amount="90.00",
    )
    result = fraud_risk_score(req)
    assert result.riskLevel == "HIGH"
    assert result.reviewRecommended is True
    assert result.riskScore <= 1.0
    assert len(result.reasons) == 4


def test_first_order_high_amount_is_currency_local_signal():
    req = FraudRiskRequest(
        payment=FraudPayment(amount="900.00", currency="PKR", outcome="FAILED"),
        signals=FraudSignals(
            failedPayments24h=1,
            paymentAttempts1h=1,
            paymentAttempts24h=1,
            priorSucceededPayments=0,
            distinctIpAddresses24h=1,
            distinctUserAgents24h=1,
            marketP95Amount="800.00",
        ),
    )
    result = fraud_risk_score(req)
    assert result.riskLevel == "LOW"
    assert result.riskScore == 0.30
    assert result.reasons[0].code == "UNUSUALLY_HIGH_FIRST_ORDER"
