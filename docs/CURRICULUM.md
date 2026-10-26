# Curriculum map

Backend Fieldguide by harshitgupta31415.

The original lesson IDs 01–60 are preserved. The practical track extends the course with synthetic exercises; optional advanced tracks are outside this standard single-store foundation.

**28 parts · 108 lessons · 16 practical missions**

## Part 01: How backends work

Trace a request from a customer action to a saved result.

| ID | Lesson | Main question |
| --- | --- | --- |
| 01 | Follow one request | What happens after a customer clicks Add to cart? |
| 02 | HTTP and JSON | How do the browser and server understand each other? |
| 03 | APIs are agreements | How can frontend and backend work independently? |
| 04 | Validation and useful errors | What should happen when a request is wrong? |
| 05 | Immediate work and background jobs | Should checkout wait while an email is sent? |

## Part 02: Data foundations

Explain relationships and protect stored data from invalid changes.

| ID | Lesson | Main question |
| --- | --- | --- |
| 06 | Entities and relationships | Which facts should the store save separately? |
| 07 | Keys and database constraints | How does the database protect important rules? |
| 08 | SQL and everyday data operations | How does code read and change stored records? |
| 09 | Transactions and competing requests | What if two customers buy the final item together? |
| 10 | Migrations and indexes | How can a live database evolve safely? |

## Part 03: Identity and security

Protect identities, ownership, secrets and sensitive data.

| ID | Lesson | Main question |
| --- | --- | --- |
| 11 | Authentication versus authorization | Does being signed in permit every action? |
| 12 | Sessions, cookies, and tokens | How does the server remember a signed-in customer? |
| 13 | Ownership, roles, and least privilege | What should customers, support staff, and admins each do? |
| 14 | Secrets and abuse protection | What changes when someone sends hostile requests? |
| 15 | Privacy and audit history | Which information should the store keep, show, or record? |

## Part 04: Catalog and cart

Model sellable items, quantities, carts and trustworthy totals.

| ID | Lesson | Main question |
| --- | --- | --- |
| 16 | Products, variants, and SKUs | What exactly does a customer purchase? |
| 17 | Inventory and reservation rules | When does an item stop being available to others? |
| 18 | Authoritative prices and money | Who decides the final amount to charge? |
| 19 | Cart lifecycle and guest merging | What happens to a guest cart after sign-in? |
| 20 | Discounts, tax, and delivery quotes | Why can checkout totals change after an address is entered? |

## Part 05: Checkout and payments

Handle verified payments, duplicates and uncertain outcomes.

| ID | Lesson | Main question |
| --- | --- | --- |
| 21 | Checkout: agree on the final purchase | What exactly is the customer agreeing to pay for? |
| 22 | Payments: track each attempt | Does opening the success page prove that money was collected? |
| 23 | Webhooks: verify, save, then process | How can the store trust a payment notification and recover after a crash? |
| 24 | Idempotency: repeat safely | What prevents two clicks from creating two purchases? |
| 25 | Reconcile uncertain and late payments | What if payment succeeds after the store releases the reserved stock? |

## Part 06: Orders and fulfillment

Keep orders, stock, shipments and refunds consistent.

| ID | Lesson | Main question |
| --- | --- | --- |
| 26 | Keep three kinds of status separate | Can an order be paid, partly shipped, and awaiting a refund at the same time? |
| 27 | Save what was actually purchased | Should changing today's product price rewrite last month's order? |
| 28 | Reserve stock without overselling | What happens when two customers try to buy the last unit? |
| 29 | Shipments: track items and quantities | How do you represent two packages arriving on different days? |
| 30 | Cancellations, returns, and refunds | Does approving a return immediately put money and stock back? |

## Part 07: Async work and integrations

Finish background work reliably when other systems fail.

| ID | Lesson | Main question |
| --- | --- | --- |
| 31 | Queues and workers: finish work later | Why should checkout not wait while the store generates a large invoice? |
| 32 | Retries: wait, limit, and investigate | Why can retrying faster make an outage worse? |
| 33 | The outbox: remember what must be sent | What if an order saves successfully but the email job is never created? |
| 34 | External APIs: expect limits and delays | What should the store do while the shipping provider is unavailable? |
| 35 | Scheduled jobs: repair and maintain | What if the expiry job misses its scheduled minute or runs twice? |

## Part 08: Speed and scale

Measure bottlenecks and improve speed without losing correctness.

| ID | Lesson | Main question |
| --- | --- | --- |
| 36 | Pagination, filtering, and search | Why should the backend avoid sending the entire product catalog at once? |
| 37 | Indexes and the cost of database work | Why can one page cause a hundred database requests? |
| 38 | Caching: decide what may be stale | Can a cached product page decide whether the last unit can be sold? |
| 39 | Files, validated uploads, and delivery | Why is a file named photo.jpg not automatically a safe image? |
| 40 | Scale from measured bottlenecks | Will adding application servers fix a database already at its connection limit? |

## Part 09: Testing and debugging

Prove behavior and investigate failures with useful evidence.

| ID | Lesson | Main question |
| --- | --- | --- |
| 41 | Tests prove specific claims | How do we know a backend feature works? |
| 42 | Test what happens when things go wrong | What should happen beyond a successful purchase? |
| 43 | Test external services safely | How do we test payments and delivery connections? |
| 44 | See what the backend is doing | How do we investigate a problem we cannot see? |
| 45 | Debug with evidence | How do we move from a symptom to a verified fix? |

## Part 10: Delivery and operations

Release changes, recover data and operate the store.

| ID | Lesson | Main question |
| --- | --- | --- |
| 46 | Use Git as a change record | How can a team review and recover changes? |
| 47 | Separate environments and secrets | Why should testing have its own configuration? |
| 48 | Release code and data safely | How does a change reach customers safely? |
| 49 | Backups need a restore plan | Can we recover the store after losing data? |
| 50 | Monitor what customers depend on | How will we notice and handle a live failure? |

## Part 11: Working precisely with AI

Specify, inspect, verify and improve AI-assisted changes.

| ID | Lesson | Main question |
| --- | --- | --- |
| 51 | Read the system before changing it | What minimum technical literacy does AI work require? |
| 52 | Write a specification AI can check | What makes a prompt precise enough to implement? |
| 53 | Keep AI changes small and reviewable | How can someone review code they did not write? |
| 54 | Give AI evidence when debugging | How do we prevent a debugging conversation from drifting? |
| 55 | Review security and launch evidence | What must be true before real customers use it? |

## Part 12: Assemble the complete backend

Connect the parts and demonstrate an end-to-end working store.

| ID | Lesson | Main question |
| --- | --- | --- |
| 56 | Choose boundaries before extra services | How can one application stay understandable as the store grows? |
| 57 | Connect records to API contracts | Can you trace every important screen action to its authoritative records? |
| 58 | Trace the complete purchase journey | What evidence links one customer's cart to a paid, fulfillable order? |
| 59 | Make staff and customer actions agree | What happens when a customer cancels while staff prepare a shipment? |
| 60 | Demonstrate readiness with evidence | What would convince another developer that the store is ready to operate? |

## Part 13: Local development and project setup

Start Fieldstore deliberately and locate failures using the actual project and runtime.

| ID | Lesson | Main question |
| --- | --- | --- |
| 61 | Know the project before installing | Which runtime and packages does Fieldstore actually need? |
| 62 | Run the right server in the right place | Why can a correct command fail in the wrong folder or port? |
| 63 | Find the layer that actually failed | Should a blank screen send you to the terminal, console, or network panel? |

**Practice mission:** Rescue the local startup — Fieldstore will not start. Inspect each synthetic terminal clue and choose the smallest repair. No commands are executed by this mission.

## Part 14: Environment variables and secrets

Classify configuration, load it predictably, and prevent cross-environment secret exposure.

| ID | Lesson | Main question |
| --- | --- | --- |
| 64 | Give every setting a trust level | Which configuration can Fieldstore safely send to a browser? |
| 65 | Load, validate, and freeze configuration | Why did changing a public variable fail to change the built app? |
| 66 | Separate environments and recover exposure | How do you stop a test from becoming a production write? |

**Practice mission:** Repair the configuration boundary — Sort each described item by intended destination, then repair the simulated configuration. All displayed values are synthetic; an example-placeholder is nonfunctional documentation, not a credential.

## Part 15: Connect a Next.js backend

Trace UI actions through trusted server operations and explicit HTTP contracts.

| ID | Lesson | Main question |
| --- | --- | --- |
| 67 | Place browser and server work deliberately | Does a Client Component make every imported secret safe? |
| 68 | Turn a Route Handler into a clear contract | What should a malformed cart request receive instead of a stack trace? |
| 69 | Connect a button to a verified cart change | How does Fieldstore know that Add to cart really worked? |

**Practice mission:** Assemble Add to cart — Order this specific Fieldstore mutation route, then find misplaced checks. This model saves cart intention but does not reserve stock.

## Part 16: Supabase database and access

Choose a connection path and prove database grants, constraints, and ownership policies.

| ID | Lesson | Main question |
| --- | --- | --- |
| 70 | Build a reproducible Supabase data model | What does Supabase provide, and what must Fieldstore still decide? |
| 71 | Choose the right database access path | Is a Supabase SDK request the same as opening a Postgres connection? |
| 72 | Prove grants and ownership with two users | How do you know Customer A cannot reach Customer B's order? |

**Practice mission:** Defend two customer accounts — Use a publishable component key and distinct synthetic user identities. Secret-key success is not evidence that customer policies work.

## Part 17: Supabase authentication lifecycle

Verify sessions and safely manage sign-in, callbacks, roles, and account lifecycle.

| ID | Lesson | Main question |
| --- | --- | --- |
| 73 | Connect signup, recovery, and callbacks | Where should Fieldstore send someone after identity verification? |
| 74 | Verify and refresh cookie-based sessions | Why is reading a session cookie different from verifying its user? |
| 75 | Control staff roles and account removal | Can a customer become an admin by editing their own profile? |

**Practice mission:** Repair the identity journey — Follow three synthetic account incidents without logging tokens, contacting Auth, or creating users.

## Part 18: Supabase storage and server tools

Protect files and use realtime and functions only where their boundaries are understood.

| ID | Lesson | Main question |
| --- | --- | --- |
| 76 | Separate public photos from private files | Should a customer invoice use the same public bucket as a product photo? |
| 77 | Use realtime as a useful update signal | Does a live event replace the authoritative order request? |
| 78 | Run functions with explicit permissions | Does moving code into a function make it trusted automatically? |

**Practice mission:** Protect files and recover live updates — Configure the intended access behavior for synthetic Fieldstore photos, invoices, updates, and function work. No bucket, subscription, or function is created.

## Part 19: Vercel deployment lifecycle

Diagnose builds, environment scope, server execution and release behavior without deploying.

| ID | Lesson | Main question |
| --- | --- | --- |
| 79 | From source to a configured build | Why can a green build still produce a broken checkout? |
| 80 | Server execution, caches and durable work | Should a shipment retry run in a forgotten background promise? |
| 81 | Domains, protected previews and rollback | Why can login fail after the domain starts serving correctly? |

**Practice mission:** Repair the simulated preview — Inspect a fictional release of Fieldstore. Choose the change supported by the evidence. Nothing is deployed.

## Part 20: Render services and workers

Choose a service type and diagnose startup, health, storage and worker failures.

| ID | Lesson | Main question |
| --- | --- | --- |
| 82 | Choose a Render service and start it | Why does a working local API become unreachable as a web service? |
| 83 | Health checks, restarts and shutdown | Is a process that is running necessarily ready to serve orders? |
| 84 | Durable files, queues and network boundaries | Where did the uploaded invoice go after the service restarted? |

**Practice mission:** Bring the service back to healthy — Diagnose four local fixtures representing a Render API and worker. Every fix is a teaching decision, not a cloud change.

## Part 21: Connect the architecture

Place responsibilities, credentials and data connections in a stack justified by the store.

| ID | Lesson | Main question |
| --- | --- | --- |
| 85 | A Next.js application with Supabase | Can one application own the storefront and its server rules? |
| 86 | When a separate API or worker is justified | What requirement earns another service a place in the architecture? |
| 87 | Choose the smallest architecture that meets the need | Can fewer services be the more complete solution? |

**Practice mission:** Place the store components — Place each responsibility in the simplest appropriate zone for our chosen example: browser, trusted application server, durable data service or optional worker. All three platforms are optional choices.

## Part 22: Book a shipment safely

Prepare, quote and book a synthetic Shiprocket shipment with reliable identifiers and recovery.

| ID | Lesson | Main question |
| --- | --- | --- |
| 88 | Prepare and quote a shipment | What must be known before the store promises a shipping price? |
| 89 | Book once and recover an uncertain result | A booking request timed out. Is it safe to create another shipment? |
| 90 | AWB, labels, manifests and pickup | Does generating a label mean the parcel has left the warehouse? |

**Practice mission:** Book one parcel without duplicates — Follow a synthetic Fieldstore parcel through quote, booking timeout and pickup preparation. No Shiprocket request is made.

## Part 23: Tracking, returns and COD

Handle delivery exceptions, returns, money and stock without confusing their separate states.

| ID | Lesson | Main question |
| --- | --- | --- |
| 91 | Trust tracking events and reconcile gaps | Can a delayed in-transit event undo a delivered shipment? |
| 92 | Failed delivery, reattempt and return paths | Is an undelivered parcel already back in sellable stock? |
| 93 | Inspection, refunds and COD remittance | Does delivered mean the store has received the money? |

**Practice mission:** Resolve delivery, return and money separately — Work through an event timeline with safe decisions. The store, provider, bank and warehouse facts remain separate.

## Part 24: Connect a payment provider

Connect trusted checkout totals to verified payment, refund and settlement evidence.

| ID | Lesson | Main question |
| --- | --- | --- |
| 94 | Create a trusted payment attempt | Which amount and order should hosted checkout receive? |
| 95 | Verify payment before fulfillment | What should happen when the browser says success but the backend is uncertain? |
| 96 | Capture, refunds and settlement are different | When does a successful payment become money in the merchant bank? |

**Practice mission:** The unverified payment desk — The browser, backend and provider show different clues. Decide what Fieldstore should display and do without making real payment calls.

## Part 25: Email, SMS and notifications

Send useful customer messages once per intent and distinguish acceptance from delivery.

| ID | Lesson | Main question |
| --- | --- | --- |
| 97 | Choose the message and prove the sender | What makes a receipt different from a marketing campaign? |
| 98 | Queue one notification intent | How do five order events produce one confirmation message? |
| 99 | Accepted, delivered or failed? | What does the provider know about the customer receiving a message? |

**Practice mission:** One order, one useful message — Trace a repeated order event through a durable intent, a provider attempt and delivery feedback. All recipients and messages are synthetic.

## Part 26: Networking and security in practice

Diagnose browser and service boundaries without weakening access or exposing secrets.

| ID | Lesson | Main question |
| --- | --- | --- |
| 100 | Follow DNS, HTTPS and callbacks | Which layer fails before the application receives a request? |
| 101 | CORS, cookies and CSRF solve different problems | Why can an API client succeed while a browser request fails? |
| 102 | Protect expensive and untrusted boundaries | Which checks still matter after login succeeds? |

**Practice mission:** Find the failing boundary — Compare browser and server evidence before changing security configuration. Diagnose each local scenario and preserve the permission rules.

## Part 27: Operate and recover the store

Investigate incidents, recover work and prove that business records agree.

| ID | Lesson | Main question |
| --- | --- | --- |
| 103 | Build an evidence trail for the store | How can one failed checkout be followed across components? |
| 104 | Recover workers, connections and stale caches | Why can adding more workers make a backlog worse? |
| 105 | Restore data and reconcile external reality | What does a database restore fail to undo? |

**Practice mission:** Recover the morning backlog — A synthetic incident crosses workers, payments and recovery records. Choose the evidence and repairs that preserve business history.

## Part 28: The connected Fieldstore capstone

Trace one purchase from signup to refund with permissions, failures and verification.

| ID | Lesson | Main question |
| --- | --- | --- |
| 106 | Capstone: identity, product and cart | Can you trace a customer action without losing its owner or price? |
| 107 | Capstone: checkout, payment and order | How does one last shirt become one paid order? |
| 108 | Capstone: shipment, tracking, return and refund | Can the journey finish without erasing its history? |

**Practice mission:** Fieldstore: one complete purchase — Follow customer-A through ten connected stages. Start with one sellable blue shirt at 25000 INR minor units, onHand 1 and reserved 0. Shipping is free and tax is included only for this synthetic exercise. Every decision preserves an evidence trail.

## Optional advanced extensions

These are suggested follow-on tracks, not included lessons or claimed competencies.

- **Subscriptions and recurring billing** — Extension beyond the single-store foundation: renewals, payment mandates, plan changes, proration, cancellation and failed recurring collection. Prerequisites: Verified one-time payments, idempotent events, refund ledgers and explicit entitlement rules..
- **Marketplaces, seller onboarding, commissions and payouts** — Extension beyond the single-store foundation: separate seller identities, seller approval, split funds, platform fees, payout eligibility and reconciliation. Prerequisites: Ownership policies, financial ledgers, onboarding requirements and provider-supported marketplace capabilities..
- **Multiple warehouses and split fulfillment** — Extension beyond the single-store foundation: location-level availability, allocation policy, partial shipments, transfers and per-package return tracking. Prerequisites: Atomic reservation model, inventory movements and stable order-line/fulfillment identities..
- **International currencies, tax, customs and duties** — Extension beyond the single-store foundation: currency precision, exchange-rate ownership, localized tax rules, import documents and duty responsibilities. Prerequisites: Trusted quotes, monetary ledgers and business-approved specialist guidance for each market..
- **Disputes and chargebacks** — Extension beyond the single-store foundation: dispute evidence, response deadlines, reversals, representment and customer-service coordination. Prerequisites: Payment/refund history, auditable order and delivery evidence, access control and provider dispute documentation..
- **ERP, accounting and warehouse integrations** — Extension beyond the single-store foundation: system-of-record decisions, external identifiers, synchronization, reconciliation and conflicting updates. Prerequisites: Outbox/retry patterns, versioned contracts, inventory/finance ledgers and operational replay controls..
- **Advanced search, event streaming and distributed systems** — Extension beyond the single-store foundation: indexed projections, event retention, replay, partition ordering, service ownership and measurable consistency tradeoffs. Prerequisites: Query measurement, cache invalidation, idempotent consumers and a demonstrated need for added infrastructure..
