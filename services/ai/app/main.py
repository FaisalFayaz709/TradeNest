from fastapi import FastAPI
from fastapi.responses import PlainTextResponse

from .pricing import SmartPricingRequest, SmartPricingSuggestion, smart_pricing_suggestion
from .observability import metrics, observe_http_request
from .fraud import FraudRiskRequest, FraudRiskScore, fraud_risk_score

from .recommendations import (
    PersonalizedRecommendationRequest,
    RecommendationSet,
    SimilarRecommendationRequest,
    personalized_recommendations,
    similar_product_recommendations,
)

app = FastAPI(
    title="TradeNest AI Service",
    version="0.1.0",
    description="Internal machine-learning service. Not a browser-facing marketplace API.",
)


@app.middleware("http")
async def observability_middleware(request, call_next):
    return await observe_http_request(request, call_next)


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "tradenest-ai", "status": "ok"}


@app.get("/health/ready")
def readiness() -> dict[str, str]:
    return {"service": "tradenest-ai", "status": "ready"}


@app.get("/internal/metrics", response_class=PlainTextResponse)
def internal_metrics() -> str:
    return metrics.render_prometheus()


@app.post("/internal/recommendations/personalized", response_model=RecommendationSet)
def personalized(request: PersonalizedRecommendationRequest) -> RecommendationSet:
    return personalized_recommendations(request)


@app.post("/internal/recommendations/similar", response_model=RecommendationSet)
def similar(request: SimilarRecommendationRequest) -> RecommendationSet:
    return similar_product_recommendations(request)


@app.post("/internal/pricing/suggest", response_model=SmartPricingSuggestion)
def pricing_suggestion(request: SmartPricingRequest) -> SmartPricingSuggestion:
    return smart_pricing_suggestion(request)


@app.post("/internal/fraud/score", response_model=FraudRiskScore)
def fraud_score(request: FraudRiskRequest) -> FraudRiskScore:
    return fraud_risk_score(request)
