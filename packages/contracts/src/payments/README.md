# payments contracts

This contract surface activates this blueprint-reserved contract namespace for payment transport boundaries.

It contains:

- payment response/status contracts;
- payment-initiation response contract;
- payment webhook acknowledgement contract;
- development sandbox webhook payload validation.

Business rules remain in NestJS services and durable integrity remains in PostgreSQL. The sandbox webhook schema is an implementation decision and must not be mistaken for a locked production-provider contract.
