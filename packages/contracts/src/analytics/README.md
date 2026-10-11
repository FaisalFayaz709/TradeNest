# Analytics contracts

This contract surface introduced behavior-event ingestion contracts for the recommendation MVP.
This contract surface adds seller analytics response contracts for authoritative backend metrics.

Seller analytics money is returned as decimal strings and grouped by ISO-style three-letter currency code. TradeNest does not silently mix currencies or perform FX conversion. Conversion rate is non-financial and nullable when no product-view denominator exists.
