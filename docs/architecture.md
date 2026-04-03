# DoorDash Architecture: Current State vs MPP Future

## Current State

How DoorDash processes orders and payments today.

```
                            CUSTOMER EXPERIENCE
                      ================================

                        Customer (App / Web)
                                |
                          Credit Card /
                          Apple Pay / etc.
                                |
                                v
                    +-------------------------+
                    |     Stripe Connect      |  <-- 2.0-2.5% + $0.15/tx
                    |   (Payment Processing)  |      + chargeback costs
                    +-------------------------+
                                |
                                v
 +------------------------------------------------------------------+
 |                                                                    |
 |                     DoorDash Platform                              |
 |                                                                    |
 |  +------------+    +-------------+    +-----------------------+    |
 |  |  BFF       | -> | Order       | -> | DeepRed               |   |
 |  |  Gateway   |    | Service     |    | (Dispatch/Logistics)  |   |
 |  +------------+    +-------------+    +-----------------------+   |
 |        |                  |                      |                 |
 |        |            +-----+------+               |                 |
 |        |            |            |               |                 |
 +------------------------------------------------------------------+
          |            |            |               |
          |            v            v               v
          |     +-----------+  +---------+    +-----------+
          |     | Restaurant|  | Merchant|    |  Dasher   |
          |     | (Webhook/ |  | Portal  |    |  App      |
          |     |  POS API) |  |         |    |           |
          |     +-----------+  +---------+    +-----------+
          |            |                           |
          |            v                           v
          |     Weekly/Daily ACH           Weekly ACH /
          |     via Stripe Connect         Fast Pay ($1.99)
          |     (net of commission)        via Stripe Express
          |
          |
    PAYMENT COSTS PER ORDER
    =======================
    Processing:    ~$0.70-0.90
    Chargebacks:   ~$0.15-0.20
    ─────────────────────────
    Total:         ~$0.85-1.10

    NO AGENT CHANNEL EXISTS
    =======================
    - No API for external AI agents
    - No way for agents to pay
    - Revenue limited to human app users
```

## Future State with MPP

How DoorDash could process agent orders using Tempo's Machine Payments Protocol.

```
                        DUAL CHANNEL: HUMANS + AGENTS
                  ==========================================

    Customer (App / Web)              AI Agent (Claude, GPT, etc.)
            |                                    |
      Credit Card /                         Stablecoin
      Apple Pay / etc.                      (pathUSD / USDC)
            |                                    |
            v                                    v
  +-------------------+              +----------------------+
  |  Stripe Connect   |              |    MPP on Tempo      |  <-- ~$0.01/session
  |  (existing rails) |              |  (Machine Payments   |      $0 chargebacks
  +-------------------+              |   Protocol)          |
            |                        +----------------------+
            |                                    |
            v                                    v
 +------------------------------------------------------------------+
 |                                                                    |
 |                     DoorDash Platform                              |
 |                                                                    |
 |  +------------+    +-------------+    +-----------------------+    |
 |  |  BFF       | -> | Order       | -> | DeepRed               |   |
 |  |  Gateway   |    | Service     |    | (Dispatch/Logistics)  |   |
 |  +------------+    +-------------+    +-----------------------+   |
 |        |                  |                      |                 |
 |  +------------+     +-----+------+               |                 |
 |  | MPP-Gated  |     |            |               |                 |
 |  | Agent APIs |     |            |               |                 |
 |  | (mppx)     |     |            |               |                 |
 |  +------------+     |            |               |                 |
 |                      |            |               |                 |
 +------------------------------------------------------------------+
                        |            |               |
                        v            v               v
                 +-----------+  +---------+    +-----------+
                 | Restaurant|  | Merchant|    |  Dasher   |
                 | (Webhook/ |  | Portal  |    |  App      |
                 |  POS API) |  |         |    |           |
                 +-----------+  +---------+    +-----------+
                        |                           |
                        v                           v
                 Weekly/Daily ACH           Weekly ACH /
                 (unchanged)                Fast Pay
                                            (unchanged)


    WHAT CHANGES                         WHAT STAYS THE SAME
    ============                         ====================
    + New agent order channel            - Restaurant integration
    + MPP-gated APIs ($0.01/call)        - Dasher dispatch (DeepRed)
    + Stablecoin settlement              - Commission structure
    + ~98% lower processing costs        - Service/delivery fees
    + Zero chargebacks                   - Restaurant/Dasher payouts
    + API abuse prevention (free)        - Merchant Portal
                                         - Human app (runs in parallel)


    AGENT ORDER PAYMENT FLOW (DETAIL)
    ==================================

    AI Agent                    DoorDash MPP Server           Tempo Blockchain
       |                              |                             |
       |-- GET /api/restaurants ----->|                             |
       |<-- 402 Payment Required -----|                             |
       |                              |                             |
       |-- Sign payment tx ---------------------------------------->|
       |                              |                             |
       |-- GET /api/restaurants ----->|                             |
       |   (with payment credential)  |-- Verify on-chain -------->|
       |                              |<-- Confirmed --------------|
       |<-- 200 + Payment-Receipt ----|                             |
       |                              |                             |
       |   ... browse menus ...       |   (same 402 -> pay flow)   |
       |                              |                             |
       |-- POST /api/orders --------->|                             |
       |   (with payment credential)  |-- Verify $29.87 --------->|
       |                              |<-- Confirmed --------------|
       |<-- 200 Order Confirmed ------|                             |
       |                              |                             |
                                      |                             |
                              DoorDash keeps:              Settled in <1 sec
                              - Service fee ($2.49)        on Tempo blockchain
                              - API fees ($0.06)
                              - Commission (~25%)

                              Passes through:
                              - Food cost -> Restaurant
                              - Tax -> Government
                              - Tip -> Dasher
```

## Key Architectural Decisions

### What DoorDash adds (minimal integration surface)

```
npm install mppx

// 1. Create MPP server (one-time setup)
const mppServer = Mppx.create({
  methods: tempo({ account: doorDashWallet, testnet: true })
});

// 2. Gate any API route (one line per endpoint)
const result = await mppServer.charge({ amount: "0.01" })(request);
if (result.status === 402) return result.challenge;
```

That's it. The existing order pipeline (Order Service, DeepRed dispatch, restaurant webhooks, Dasher assignment) is completely unchanged. MPP is an additive layer at the API boundary.

### What DoorDash does NOT need to change

- Restaurant integration (Marketplace API, POS webhooks)
- Dasher dispatch (DeepRed optimizer)
- Restaurant/Dasher payouts (Stripe Connect / Stripe Express / ACH)
- Commission and fee structure
- Mobile/web app for human customers
- Order Service, Cassandra, Kafka, Cadence workflows

### Migration path

1. **Phase 1**: Add MPP-gated agent APIs alongside existing human app (no risk to current business)
2. **Phase 2**: Scale agent order volume, measure processing savings
3. **Phase 3**: Optionally offer stablecoin payouts to restaurants/Dashers who want instant settlement
