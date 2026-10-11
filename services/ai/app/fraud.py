from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MODEL_VERSION = "fraud-rules-v1"


class FraudPayment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount: str = Field(pattern=r"^\d+\.\d{2}$")
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    outcome: Literal["SUCCEEDED", "FAILED"]


class FraudSignals(BaseModel):
    model_config = ConfigDict(extra="forbid")

    failedPayments24h: int = Field(ge=0)
    paymentAttempts1h: int = Field(ge=0)
    paymentAttempts24h: int = Field(ge=0)
    priorSucceededPayments: int = Field(ge=0)
    distinctIpAddresses24h: int = Field(ge=0)
    distinctUserAgents24h: int = Field(ge=0)
    marketP95Amount: str | None = Field(default=None, pattern=r"^\d+\.\d{2}$")


class FraudRiskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    payment: FraudPayment
    signals: FraudSignals


FraudReasonCode = Literal[
    "REPEATED_PAYMENT_FAILURES",
    "UNUSUALLY_HIGH_FIRST_ORDER",
    "ABNORMAL_TRANSACTION_FREQUENCY",
    "SESSION_IDENTITY_CHURN",
]


class FraudReason(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: FraudReasonCode
    message: str
    contribution: float = Field(ge=0.0, le=1.0)


class FraudRiskScore(BaseModel):
    model_config = ConfigDict(extra="forbid")

    riskScore: float = Field(ge=0.0, le=1.0)
    riskLevel: Literal["LOW", "MEDIUM", "HIGH"]
    reasons: list[FraudReason] = Field(max_length=8)
    reviewRecommended: bool
    modelVersion: str
    generatedAt: datetime


def _risk_level(score: float) -> Literal["LOW", "MEDIUM", "HIGH"]:
    if score >= 0.70:
        return "HIGH"
    if score >= 0.35:
        return "MEDIUM"
    return "LOW"


def fraud_risk_score(request: FraudRiskRequest) -> FraudRiskScore:
    signals = request.signals
    reasons: list[FraudReason] = []
    score = 0.0

    if signals.failedPayments24h >= 2:
        contribution = min(0.36, signals.failedPayments24h * 0.12)
        score += contribution
        reasons.append(
            FraudReason(
                code="REPEATED_PAYMENT_FAILURES",
                message="Multiple payment failures were recorded for this buyer in the last 24 hours.",
                contribution=round(contribution, 4),
            )
        )

    if signals.priorSucceededPayments == 0 and signals.marketP95Amount is not None:
        current_amount = Decimal(request.payment.amount)
        market_p95 = Decimal(signals.marketP95Amount)
        if market_p95 > 0 and current_amount >= market_p95:
            contribution = 0.30
            score += contribution
            reasons.append(
                FraudReason(
                    code="UNUSUALLY_HIGH_FIRST_ORDER",
                    message="A first successful-payment candidate is at or above the same-currency marketplace 95th-percentile amount.",
                    contribution=contribution,
                )
            )

    frequency_contribution = 0.0
    if signals.paymentAttempts1h >= 5:
        frequency_contribution = 0.25
    elif signals.paymentAttempts24h >= 12:
        frequency_contribution = 0.15
    if frequency_contribution:
        score += frequency_contribution
        reasons.append(
            FraudReason(
                code="ABNORMAL_TRANSACTION_FREQUENCY",
                message="The buyer has an unusually high number of recent payment attempts.",
                contribution=frequency_contribution,
            )
        )

    session_contribution = 0.0
    if signals.distinctIpAddresses24h >= 4:
        session_contribution += 0.15
    if signals.distinctUserAgents24h >= 4:
        session_contribution += 0.10
    session_contribution = min(0.20, session_contribution)
    if session_contribution:
        score += session_contribution
        reasons.append(
            FraudReason(
                code="SESSION_IDENTITY_CHURN",
                message="Recent authenticated sessions show elevated IP-address or user-agent churn.",
                contribution=round(session_contribution, 4),
            )
        )

    score = round(min(1.0, max(0.0, score)), 4)
    level = _risk_level(score)
    return FraudRiskScore(
        riskScore=score,
        riskLevel=level,
        reasons=reasons,
        reviewRecommended=level == "HIGH",
        modelVersion=MODEL_VERSION,
        generatedAt=datetime.now(timezone.utc),
    )
