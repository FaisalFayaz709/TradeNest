# Review contracts

This contract surface implements the blueprint review API. A review creation request identifies the purchased `orderItemId`; product identity and buyer eligibility are derived by the backend from the completed order item. Rating is restricted to 1–5. The blueprint does not specify a comment length, so this contract does not invent one.
