# DisputesModule

This module owns dispute opening, participant/Admin reads, dispute messages, evidence references and Admin financial resolution.

Persistence ownership:
- `disputes`
- `dispute_messages`
- `dispute_evidence`

Cross-module state changes use public module APIs only:
- Orders owns Order state.
- Escrow owns Escrow state and ledger entries.
- Payments is reached only inside Escrow's provider-neutral refund seam.

An OPEN dispute remains the public policy signal used to block buyer automatic release.
