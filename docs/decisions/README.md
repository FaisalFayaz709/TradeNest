# Architecture Decision Records (ADRs)

Use ADRs only for choices the blueprint leaves open.

An ADR may not override a **LOCKED** blueprint decision.

## Examples that should receive ADRs

- exact payment provider;
- S3-compatible storage provider vs Cloudinary;
- cloud hosting/deployment provider;
- shipping/tax/promotion calculation rules;
- exact escrow auto-release policy (if one is introduced);
- dispute eligibility window;
- seller verification/KYC mechanism;
- notification provider;
- exact rate-limit values;
- observability vendor;
- fraud score thresholds;
- concrete recommendation/ranking algorithm beyond the staged direction.

## Naming

```text
ADR-001-payment-provider.md
ADR-002-object-storage.md
...
```

Copy `ADR-000-template.md` and increment the number.
