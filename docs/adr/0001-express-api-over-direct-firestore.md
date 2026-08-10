# ADR-0001: Express REST API over direct Firestore client access

**Status:** Accepted  
**Date:** 2026-08-04

## Context

The stack is React+Vite frontend with a Node.js+Firebase backend. Firestore can be accessed two ways from a React app: directly via the Firestore client SDK (with Firebase Security Rules enforcing access), or indirectly through a server-side API that talks to Firestore via the Firebase Admin SDK.

## Decision

All Firestore reads and writes go through Express REST endpoints. React never imports or calls the Firestore client SDK directly. Express middleware verifies the Firebase ID token on every request and enforces role-based access (HR Admin vs Employee) before route handlers execute.

## Consequences

**Good:**
- Role-based access control lives in one place (Express middleware + route handlers), not spread across Firestore Security Rules and client code.
- API surface is explicit and auditable — easy to document in the SRS.
- Business logic (e.g. leave balance calculation, numberOfDays computation) runs server-side, not in the client.
- Easier to extend later (add validation, rate limiting, logging) without touching the frontend.

**Bad:**
- Every read/write has an extra network hop through the Express server vs. the Firestore client SDK talking to Firestore directly.
- Requires running and deploying a Node.js server (not just a static frontend + Firebase).
- More boilerplate to write — REST endpoints for every operation vs. client-side Firestore queries.

## Alternatives considered

**Direct Firestore client SDK from React with Security Rules:** Simpler to set up, no server needed. Rejected because Security Rules are harder to reason about for complex role logic, business logic would leak into the client, and it makes the SRS harder to specify cleanly.
