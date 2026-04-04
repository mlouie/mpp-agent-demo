@AGENTS.md

# MPP Agent Demo

## Objective

This project exists to learn and understand Tempo's Machine Payments Protocol (MPP) by building a working demo around a realistic DoorDash use case. It serves as both a learning tool and a presentation asset that could be used by a Solutions Engineer at Tempo to pitch DoorDash on adopting MPP.

## Audience

The demo is designed to be presented to a cross-functional room at DoorDash. Each stakeholder cares about different things:

- **VP/Director of Payments Engineering** -- Integration complexity, reliability at scale, how MPP fits into their existing Stripe Connect stack. They want to see that MPP is additive (not a rip-and-replace) and that the integration surface is small.
- **Product Lead (Marketplace/Payments)** -- New capabilities unlocked by agent commerce, competitive advantage, time-to-market. They want to understand the new order channel.
- **Finance/Treasury** -- Settlement costs, chargeback elimination, cash flow timing. They want the dollar savings story.
- **Head of AI/Platform** -- How AI agents interact with DoorDash APIs, the payment standard for agentic commerce. They want to see this is where the industry is heading.

## How to Use in a Presentation

The demo tells a story in four beats. Run the app live and narrate as the agent works:

1. **"Why Now"** -- AI agents are becoming autonomous consumers. There's no standard for how they pay. MPP (co-authored by Stripe) is that standard. *Open the app, show the empty state.*

2. **"The Integration"** -- DoorDash adds one middleware to gate their APIs. The agent hits a 402, pays automatically. *Type a food request and watch the right panel light up with the first API call.*

3. **"The Economics"** -- Micropayments for browsing, real charges for orders. All settled in stablecoins in under a second. No interchange fees, no chargebacks. *Point to the DoorDash Revenue box as it accumulates. Compare $0.85-1.10/order on credit cards vs $0.01/session on MPP.*

4. **"The Scale Story"** -- At 1% agent adoption, DoorDash saves ~$20M/year. At 10%, a quarter billion. And those orders generate the same service fees and commissions as human orders. *The order settles, the timeline completes: "N interactions, 2 on-chain transactions."*

After the live demo, walk through `docs/architecture.md` which shows the current-state vs MPP architecture side by side. The key message: MPP is an additive layer at the API boundary. Nothing in DoorDash's existing stack changes.

## Narrative Framing

- **Primary value**: Reducing payment processing costs (~98% cheaper than credit cards)
- **Secondary value**: Enabling AI agents as a new order channel that drives incremental GMV
- **Tertiary value**: API abuse prevention via micropayments (the payment IS the rate limit)
- **Do NOT lead with**: "you can charge agents to browse menus" -- DoorDash doesn't charge humans to browse, and the browsing fees aren't the point. Lead with cost savings on orders.

## Code Documentation Approach

The codebase is documented for a DoorDash developer who will read it as a reference implementation after the presentation. Comments focus on:
- Why Tempo/MPP, not what TypeScript -- explain every MPP-specific decision
- Where MPP touches application code vs standard Next.js -- highlight the integration surface
- What the production equivalent would be for every demo shortcut

The most important file is `src/lib/mpp-server.ts` -- it contains the payment gateway setup and detailed talking points on cost savings and annual projections.

## Gotchas

- Restart the dev server after editing `mpp-server.ts` or `mpp-client.ts`. Hot-reload alone may not pick up Mppx initialization changes.
- Run `/api/status` before any live demo to verify Tempo RPC, wallet balance, and Claude API connectivity.
- Click "New Order" to reset between demo runs.
