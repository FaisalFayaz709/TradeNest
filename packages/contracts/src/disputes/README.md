# disputes contracts

This namespace is required by the TradeNest Technical Blueprint contract layout.

This contract surface intentionally does not invent request/response fields that the blueprint does not specify. Concrete Zod schemas belong to the corresponding feature implementation and must remain transport-boundary validation only; business rules stay in NestJS services and integrity rules stay in PostgreSQL.
