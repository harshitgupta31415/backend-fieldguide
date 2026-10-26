# Fieldstore: the connected ecommerce capstone

Trace one synthetic purchase from signup to refund. The goal is to explain every handoff: who acts, which records change, what permission applies, which service is involved, what can fail, and what evidence verifies the result.

**Signup → product → cart → checkout → payment → order → shipment → tracking → return → refund.**

The capstone belongs to part 28, lessons 106–108, and its ten-stage Practice Studio mission. It runs locally using fixtures and explained choices. It does not create accounts, contact providers, lock a real database row, book parcels or move money. Completing it demonstrates the teaching model; optional live integrations need separate setup and verification.

## The store model

- Store: **Fieldstore**, with one warehouse and a blue shirt variant, `shirt-blue-M`.
- Price: **25000 INR minor units = ₹250 per shirt**. The capstone purchases one shirt.
- Quote assumptions: shipping is zero and tax is included for this synthetic exercise only. These are not a production tax or delivery policy.
- Identities: `customer-A` owns `cart-A` and order `FS-1001`; `customer-B` is the separate account used to test denial. Staff permissions come from trusted records.
- Stable references: payment attempt `A-1`, shipment `S-1` and refund `R-1` are separate from each other and from provider IDs. All identifiers are fake.
- Provider adapters are modeled boundaries. Razorpay-shaped payment/refund fixtures and provider-neutral shipping examples do not assume that every endpoint supports idempotency, every webhook is signed, or every provider offers a sandbox.

Other course panels can use independent fixture orders, such as `FS-104`. They illustrate the same Fieldstore rules and are not a shared live database.

## Keep the state dimensions separate

| Dimension | What it records | What it does not prove |
| --- | --- | --- |
| Identity/session | The currently verified actor and trusted permissions. | That the actor owns every cart or order. |
| Cart/quote | Requested variants and a server-calculated amount. | That stock is reserved or money was collected. |
| Order | Purchase intent, owner and the purchased-item/price snapshot. | That a parcel shipped or a refund completed. |
| Reservation | A protected claim on fulfillment stock. | Physical shipment. |
| Payment | Verified collection evidence for the expected attempt. | Merchant-bank settlement. |
| Shipment/tracking | Booking references, physical handoff and mapped delivery evidence. | Payment, refund or stock inspection status. |
| Return/quarantine | Authorization, return receipt and condition inspection. | That received goods are sellable. |
| Refund | Authorized amount, provider reference and verified outcome. | That a unit was inspected or restocked. |
| Settlement | Reconciliation of provider-held funds with merchant-bank evidence. | That the customer order is delivered. |
| Notification | A unique message intent and delivery evidence. | That the person read it or that the purchase failed if mail bounced. |

## Stock arithmetic and quarantine

Here `onHand` means units in the **fulfillment stock pool**, including reserved units. `available = onHand − reserved`. Physically returned goods awaiting release are tracked in a **separate quarantine pool**; they are not yet available for another checkout.

| Checkpoint | Fulfillment onHand | Reserved | Available | Quarantined |
| --- | ---: | ---: | ---: | ---: |
| Before checkout | 1 | 0 | 1 | 0 |
| One checkout wins the last-unit claim | 1 | 1 | 0 | 0 |
| Payment is verified captured | 1 | 1 | 0 | 0 |
| Shipment is booked, before physical handoff | 1 | 1 | 0 | 0 |
| Confirmed physical handoff consumes allocation once | 0 | 0 | 0 | 0 |
| Returned parcel is physically received | 0 | 0 | 0 | 1 |
| Inspection establishes sellable condition | 0 | 0 | 0 | 1 |
| A guarded restock transfers the inspected unit | 1 | 0 | 1 | 0 |
| Refund later completes | 1 | 0 | 1 | 0 |

Adding to cart does not reserve stock in this model. Payment confirms allocation without a second deduction. Booking or printing a label does not prove shipment. Inspection authorizes a separate guarded restock; repeated restock clicks must not add units. A damaged return can remain quarantined or follow another approved disposition, and must not become sellable automatically.

An unpaid hold can expire under an explicit policy. Late payment success after release needs stock/reconciliation/refund review; it must not silently invent another unit. These arithmetic examples do not implement production concurrency control.

## The ten-stage evidence board

### 01 · Signup and verified identity

- **Actor:** Customer-A and the authentication boundary.
- **Data:** Reads session evidence; creates/loads a customer identity. Staff role data is separately controlled.
- **Permission and rule:** Verify current identity; never grant authority from user-editable profile fields.
- **Service boundary:** Synthetic auth adapter; optional real auth provider requires separate testing.
- **Failure to inject:** Expired session or forged admin metadata.
- **Verification:** Use expired and valid fixtures; confirm only the valid customer identity continues and no staff role is granted.

**Decision:** Which identity may the server rely on?

**Expected reasoning:** A currently verified session and separately controlled permissions. Reauthenticate or refresh through the supported auth flow; derive authority from trusted records.

### 02 · Product and authoritative price

- **Actor:** Catalog read handler and customer browser.
- **Data:** Reads approved product/variant fields and trusted unit price; exposes public catalog data.
- **Permission and rule:** Only approved catalog fields are public; browser pricing never becomes authoritative.
- **Service boundary:** Synthetic catalog/database records; product-image storage is separate.
- **Failure to inject:** Stale display or a tampered browser price.
- **Verification:** Change the displayed price and confirm the server quote still uses 25000 minor units.

**Decision:** Which price defines the purchase?

**Expected reasoning:** The trusted active variant price, rechecked during checkout. The display can change independently; authoritative records define the quote.

### 03 · Cart ownership and persistence

- **Actor:** Cart Route Handler using verified customer identity.
- **Data:** Reads cart owner and variant; writes cart_items only for an authorized cart.
- **Permission and rule:** Quantity is validated; ownership is enforced on the server; cart addition does not reserve stock in this model.
- **Service boundary:** Synthetic cart database; no external provider is needed.
- **Failure to inject:** Cross-customer cart ID or a browser-only unsaved update.
- **Verification:** Compare B’s denied request with A’s successful persisted change and a reload.

**Decision:** What should Add to cart do?

**Expected reasoning:** Reject B without changing cart-A; allow A and verify after reload. The resource owner must be checked before mutation.

### 04 · Checkout and the last unit

- **Actor:** Checkout service and transactional inventory boundary.
- **Data:** Reads owned cart/current quote; writes one order intent, reservation and payment-attempt identity.
- **Permission and rule:** Availability never becomes negative; only one claimant gets the last unit; quote is 25000 INR minor units.
- **Service boundary:** Synthetic database transaction model; provider payment work follows the protected intent.
- **Failure to inject:** Concurrent last-unit requests or repeated checkout clicks.
- **Verification:** Observe exactly one reservation, reserved 1/available 0, and a safe unavailable response for the other customer.

**Decision:** Which stock outcome is correct?

**Expected reasoning:** One atomic reservation succeeds; the other receives unavailable. A conditional transactional claim prevents both checkouts from consuming the same availability.

### 05 · Payment and duplicate verification

- **Actor:** Payment adapter, webhook handler and reconciliation worker.
- **Data:** Reads A-1 expected references; stores event evidence and the verified payment transition.
- **Permission and rule:** Match amount, currency and order; one logical payment effect; physical stock is not deducted at capture.
- **Service boundary:** Synthetic Razorpay-shaped fixture, not a real transaction or SDK invocation.
- **Failure to inject:** Delayed verification, wrong signature, replayed captured event or late failure.
- **Verification:** Show pending-verification first, then one captured result; replay leaves onHand 1/reserved 1 unchanged.

**Decision:** Which effect is allowed?

**Expected reasoning:** Apply one verified capture and keep one allocation. Authenticate and match evidence, then use guarded transitions and event identity to handle duplicates.

### 06 · Order confirmation and private access

- **Actor:** Order service, authenticated customer view and authorized staff view.
- **Data:** Reads order ownership; preserves item/price snapshot and one downstream work record.
- **Permission and rule:** Only permitted actors read the order; catalog edits cannot rewrite purchased history.
- **Service boundary:** Synthetic database/outbox; notification and shipment adapters consume saved work.
- **Failure to inject:** Unauthorized order access or a repeated confirmation event.
- **Verification:** Compare A/B access and count one order confirmation and one notification/shipment intent.

**Decision:** What does the order service do?

**Expected reasoning:** Deny B; let A read the saved snapshot and keep one confirmation intent. Order privacy and duplicate-safe downstream work remain required after payment.

### 07 · Shipment booking and physical handoff

- **Actor:** Authorized fulfillment worker and shipping adapter.
- **Data:** Reads order/address/package snapshot; stores provider shipment/AWB references and booking evidence.
- **Permission and rule:** One booking intent per fulfillment; protect credentials; booking is separate from physical stock consumption.
- **Service boundary:** Synthetic shipping-provider fixture; use documented Shiprocket behavior in an optional integration.
- **Failure to inject:** Expired credentials and a response lost after provider booking.
- **Verification:** Count one matched shipment; at later confirmed handoff change onHand 1/reserved 1 to onHand 0/reserved 0 exactly once.

**Decision:** Which recovery protects the order?

**Expected reasoning:** Refresh supported credentials, reconcile/link S-1, and wait for handoff evidence. Authentication failure and uncertain booking need distinct repairs; neither proves physical shipment.

### 08 · Tracking and delivery evidence

- **Actor:** Tracking event intake and reconciliation job.
- **Data:** Stores original provider event and mapped internal shipment status; reads existing transition history.
- **Permission and rule:** Authenticate using the provider’s actual scheme; handle duplicates, delay and missing events deliberately.
- **Service boundary:** Synthetic courier/aggregator tracking feed; no universal signature or sandbox is assumed.
- **Failure to inject:** Out-of-order, duplicated or absent tracking notifications.
- **Verification:** Apply the stale event and confirm delivery does not regress; demonstrate a reconciliation lookup for missing evidence.

**Decision:** How should the timeline change?

**Expected reasoning:** Retain delivered and record the stale event as evidence without regression. Map the provider status and event timing through allowed transitions.

### 09 · Return, quarantine and inspection

- **Actor:** Customer return request, authorized staff and warehouse inspection.
- **Data:** Writes return authorization, reverse-fulfillment references, received/quarantine evidence and inspection result.
- **Permission and rule:** Return ownership and policy apply; sellable stock increases only after suitable inspection, not automatically on refund.
- **Service boundary:** Synthetic reverse-shipping and warehouse records.
- **Failure to inject:** Unauthorized return, lost reverse parcel, damaged item or duplicate inspection event.
- **Verification:** Before release, available stays 0. After a sellable inspection, one guarded restock transfers the unit from quarantine to onHand 1/reserved 0/available 1.

**Decision:** When may available inventory increase?

**Expected reasoning:** After receipt and a recorded sellable inspection under policy. Quarantine separates received goods from sellable stock; record the restock exactly once.

### 10 · Refund and final reconciliation

- **Actor:** Authorized refund service, provider adapter and finance reconciliation.
- **Data:** Reads captured/refunded totals; writes a bounded refund intent, provider reference and final evidence when known.
- **Permission and rule:** Refund authority and cumulative amount checks are atomic; uncertainty must not trigger a fresh duplicate refund.
- **Service boundary:** Synthetic Razorpay-shaped refund and settlement fixtures.
- **Failure to inject:** Unauthorized refund request, double click, timeout or missing final refund event.
- **Verification:** Reject unauthorized and excessive requests; apply processed evidence once and reconcile money, stock and order history separately.

**Decision:** What should the final board show now?

**Expected reasoning:** Refund pending with its own reference; reconcile before another refund. Acceptance is not confirmed completion; keep payment, stock and refund histories separate.

## Finish with evidence, not only a green screen

Keep a short record of the inputs, actor, expected result, observed result and record references for each stage. Include these deliberate failures:

1. An expired session and a forged profile role.
2. Customer B attempting to use A's cart or read A's order.
3. Two checkouts competing for one available shirt.
4. Browser payment success before verification, a bad payment event and duplicate capture evidence.
5. Expired shipping credentials followed by a timeout after the provider has already booked the shipment.
6. Duplicate or stale tracking evidence after delivery.
7. A return received but not yet inspected, then a repeated restock action.
8. An unauthorized, excessive or uncertain refund request.

Check that one logical checkout, capture, booking, receipt and refund produce their intended effects once. Compare the order, payment, inventory, shipment, return and refund records separately. A successful customer purchase can still have pending merchant settlement or a failed notification.

Finish by explaining what the local run established and what it did not test: actual provider authentication, reachable callbacks, real SDK behavior, persistent database concurrency, real carrier events, bank settlement and production recovery. See [VERIFICATION.md](VERIFICATION.md) for the application checks actually performed, and [CURRICULUM.md](CURRICULUM.md) for the related lessons and official references.
