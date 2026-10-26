export const gameCatalog = [
  { id: 'pipeline', icon: '↬', name: 'Request relay', tag: 'Put the system in order', description: 'Rebuild three backend journeys. Every step needs the right thing to happen before it.', rounds: '3 routes', skill: 'Data flow', lesson: 1 },
  { id: 'trust', icon: '◇', name: 'Boundary keeper', tag: 'Give every layer its job', description: 'Sort eight responsibilities. Decide where a fact is collected, checked, issued, or protected.', rounds: '8 cards', skill: 'Trust boundaries', lesson: 11 },
  { id: 'detective', icon: '⌕', name: 'Incident detective', tag: 'Follow the evidence', description: 'Open three case files. Find the broken rule and choose a repair that actually protects it.', rounds: '3 cases', skill: 'Debugging', lesson: 45 },
];

export const pipelineRounds = [
  {
    id: 'cart', label: 'The disappearing cart', title: 'Get one cart change all the way home.',
    story: 'A shopper adds a blue shirt. Follow this request from the initial click to a screen that reflects the saved result. In this route, validation finishes before the cart write.',
    start: ['reply', 'click', 'save', 'render', 'request', 'check'], lesson: 1,
    steps: [
      { id: 'click', title: 'Customer clicks Add to cart', layer: 'Browser', why: 'The customer starts an intention. A click alone does not save a cart or reserve inventory.' },
      { id: 'request', title: 'Send the variant and quantity', layer: 'HTTP request', why: 'The request carries the desired variant and quantity. Client-submitted fields are still untrusted.' },
      { id: 'check', title: 'Verify cart access and quantity', layer: 'Server', why: 'The server establishes access and checks input and current business rules before applying this change.' },
      { id: 'save', title: 'Commit the cart change', layer: 'Database', why: 'A committed write makes the change survive refresh. Adding to cart does not automatically reserve stock.' },
      { id: 'reply', title: 'Return the saved cart', layer: 'HTTP response', why: 'The response describes the actual saved result or a safe error, rather than assuming that the click worked.' },
      { id: 'render', title: 'Render the confirmed result', layer: 'Browser', why: 'The screen uses the response and explains failures. A pleasant animation cannot replace persistence.' },
    ],
    takeaway: 'A screen update proves persistence only when you trace the successful request and the committed record behind it.',
  },
  {
    id: 'webhook', label: 'The resilient webhook', title: 'Accept an event without forgetting its work.',
    story: 'A payment notification enters this design: verified intake saves durable work, acknowledges receipt, and then a worker applies the business change. Order these specific stages.',
    start: ['ack', 'apply', 'receive', 'persist', 'verify'], lesson: 23,
    steps: [
      { id: 'receive', title: 'Receive the signed notification', layer: 'Incoming HTTP', why: 'The external notification arrives. Its claimed origin and contents are not trusted yet.' },
      { id: 'verify', title: 'Verify the documented signature', layer: 'Server intake', why: 'Use the provider\'s verifier, original bytes, and replay rules. A claimed event type is not proof of authenticity.' },
      { id: 'persist', title: 'Save the event and unfinished work', layer: 'Durable storage', why: 'Persist accepted work before acknowledging so a restart cannot silently lose a notification the provider considers delivered.' },
      { id: 'ack', title: 'Acknowledge durable acceptance', layer: 'HTTP response', why: 'Success means reliable receipt. It does not claim that every downstream business effect is already complete.' },
      { id: 'apply', title: 'Worker applies guarded changes', layer: 'Background work', why: 'Check purchase association, amount, currency, and allowed transitions. Deduplicate effects and keep unfinished work recoverable.' },
    ],
    takeaway: 'Verify, save, acknowledge, then process: this intake pattern protects both trust and recoverability. External effects still need their own retry protection.',
  },
  {
    id: 'outbox', label: 'The message that survives', title: 'Save the purchase and remember the follow-up.',
    story: 'This store uses an outbox: a record of work to publish. Follow a successful order through its local transaction, publication, and duplicate-safe consumer.',
    start: ['publish', 'consumer', 'prepare', 'commit', 'stage'], lesson: 33,
    steps: [
      { id: 'prepare', title: 'Validate the proposed purchase', layer: 'Server', why: 'The server establishes the accepted data, permissions, and business rules before preparing the required writes.' },
      { id: 'stage', title: 'Write order and outbox in one transaction', layer: 'Database transaction', why: 'Stage the business record and its outgoing-work record together. Neither is durable yet until the transaction commits.' },
      { id: 'commit', title: 'Commit both records together', layer: 'Atomic commit', why: 'Both records become durable together, or neither does. This closes the gap where an order exists but its message is forgotten.' },
      { id: 'publish', title: 'Publish the committed outbox event', layer: 'Publisher', why: 'A recoverable publisher sends pending committed events. Publication can repeat after a crash, so consumers must expect duplicates.' },
      { id: 'consumer', title: 'Consume with a stable operation identity', layer: 'Worker', why: 'The consumer avoids repeating the logical effect. A local outbox alone cannot promise exactly-once delivery by an external service.' },
    ],
    takeaway: 'One local transaction protects the order and intention to publish. After that boundary, recoverable retries and duplicate-safe operations still matter.',
  },
];

export const trustLayers = [
  { id: 'browser', icon: '▤', name: 'Browser', hint: 'Intent and presentation', color: 'blue' },
  { id: 'server', icon: '⌘', name: 'Server', hint: 'Permission and business decisions', color: 'teal' },
  { id: 'provider', icon: '↗', name: 'Provider', hint: 'Its own external outcomes', color: 'orange' },
  { id: 'data', icon: '▥', name: 'Database', hint: 'Durable records and constraints', color: 'violet' },
];

export const trustCards = [
  { id: 'selection', title: 'Collect the size and quantity the shopper wants.', detail: 'Which layer gathers this intention before sending it for validation?', correct: 'browser', lesson: 2,
    why: 'The browser collects intent. That does not make the requested quantity, identity, or price trustworthy; the server must still validate the request.' },
  { id: 'owner', title: 'Decide whether this customer may read order 27.', detail: 'The caller is signed in. The decision must enforce ownership for this specific order.', correct: 'server', lesson: 11,
    why: 'The server authorizes this particular resource for the verified caller. Hiding a link or showing a signed-in badge cannot enforce that permission.' },
  { id: 'capture', title: 'Report whether the payment provider captured this payment.', detail: 'Choose the source of the external payment outcome; the backend will still verify and associate its evidence.', correct: 'provider', lesson: 22,
    why: 'The provider is authoritative for its own payment outcome. The server accepts verified evidence, checks the purchase, amount, and currency, and maintains its local record.' },
  { id: 'sku', title: 'Reject two committed rows with the same unique SKU.', detail: 'Choose the layer enforcing the final uniqueness constraint even when requests overlap.', correct: 'data', lesson: 7,
    why: 'A database uniqueness constraint rejects competing duplicate writes. A server lookup before insertion can race, so application validation alone cannot guarantee uniqueness.' },
  { id: 'loading', title: 'Show a loading state and render the returned cart.', detail: 'Which layer turns the response into visible feedback for the shopper?', correct: 'browser', lesson: 1,
    why: 'The browser presents progress and the result. It should reflect server evidence and display safe failure feedback rather than treat an animation as proof of a saved change.' },
  { id: 'signature', title: 'Verify a webhook signature before accepting the event.', detail: 'The provider emitted a signature. Which layer in this store must verify the incoming notification?', correct: 'server', lesson: 23,
    why: 'The receiving backend uses the documented verifier and original request bytes. A browser redirect, event name, or claimed sender is insufficient verification.' },
  { id: 'emit', title: 'Create and sign the provider\'s payment event.', detail: 'Choose the emitter of the external event, not the store component that later verifies it.', correct: 'provider', lesson: 23,
    why: 'The provider emits its event and signature. The backend performs a separate verification step; it must not manufacture external payment evidence for itself.' },
  { id: 'atomic', title: 'Commit an order and its outbox row atomically.', detail: 'The server requested a transaction. Which layer enforces that both local records commit or neither does?', correct: 'data', lesson: 33,
    why: 'The database enforces the transaction\'s atomic commit. It cannot also atomically commit an unrelated payment-provider action; that boundary needs recovery and reconciliation.' },
];

export const detectiveCases = [
  {
    id: 'duplicate', number: 'CASE 001', title: 'Two orders. One payment.', subtitle: 'A second notification should not become a second purchase.', lesson: 24,
    report: 'Support sees two orders after one checkout. The customer says they clicked Pay once. All references below are synthetic.',
    clues: [
      { title: 'Provider ledger', body: 'One captured payment: pay_demo_81, amount 500.00 INR. No second capture appears.' },
      { title: 'Delivery log', body: 'The same valid success event, evt_demo_4, was delivered twice after an acknowledgement timeout.' },
      { title: 'Application trace', body: 'Both handler executions inserted a new order. No unique event receipt, guarded payment transition, or purchase-operation claim was enforced.' },
    ],
    choices: [
      { text: 'Refund both orders immediately because two rows prove two charges.', correct: false, why: 'The provider evidence shows one capture. Order-row count does not establish money movement. Blind refunds could return the wrong amount and still leave the processing defect.' },
      { text: 'Protect the logical operation and reconcile the duplicate order records.', correct: true, why: 'Use database-backed operation identity, unique event receipt, and guarded changes. Also protect different events for the same payment. Review affected orders, stock effects, and verified money before corrective work.' },
      { text: 'Hide the second order in the interface and leave backend processing unchanged.', correct: false, why: 'Hiding a row does not undo duplicate stock allocations or stop another event creating more records. The protection belongs where the business effect commits.' },
    ],
    resolution: 'A delivery is not a new intention. Record receipts and operation identity durably, make business transitions duplicate-safe, and reconcile existing damage from trustworthy evidence.',
  },
  {
    id: 'stock', number: 'CASE 002', title: 'The last shirt sold twice.', subtitle: 'Both checks passed. The shared rule still broke.', lesson: 9,
    report: 'Two shoppers reserved the final Medium shirt. No shipment has occurred. The store\'s model is available = on-hand − reserved.',
    clues: [
      { title: 'Opening inventory', body: 'On-hand: 1. Reserved: 0. Available: 1. Overselling is not allowed by this store.' },
      { title: 'Overlapping requests', body: 'Request A and request B both read available = 1 before either created its reservation.' },
      { title: 'Final records', body: 'Each request then wrote a reservation of 1 without protecting the check and change together. Reserved became 2; on-hand stayed 1.' },
    ],
    choices: [
      { text: 'Make the availability check and reservation one atomic protected decision.', correct: true, why: 'A conditional update or correctly locked transaction allows only one claim. The other receives a defined unavailable result. Payment later confirms allocation; shipment consumes on-hand and its allocation once.' },
      { text: 'Cache available = 1 longer so both requests see a consistent value.', correct: false, why: 'The cached value would be consistently stale. A cache cannot allocate the final unit or stop competing requests from committing incompatible reservations.' },
      { text: 'Reduce on-hand at every payment callback, including retries.', correct: false, why: 'That does not protect the earlier allocation race and would introduce duplicate deductions. This model changes on-hand at shipment, with repeat-safe inventory movements.' },
    ],
    resolution: 'A check is a snapshot, not a claim. Protect the decision and allocation together, then make every later release or shipment transition safe to repeat.',
  },
  {
    id: 'ownership', number: 'CASE 003', title: 'A customer sees a stranger\'s order.', subtitle: 'Signed in does not mean allowed everywhere.', lesson: 11,
    report: 'A customer edits an order identifier in the address bar and sees another customer\'s delivery details. The regular interface never linked to that order.',
    clues: [
      { title: 'Identity check', body: 'The session is valid for customer_demo_A. Authentication succeeded.' },
      { title: 'Target record', body: 'The requested order belongs to customer_demo_B. Customer A has no staff permissions.' },
      { title: 'Handler trace', body: 'The handler checks only that a session exists, then selects the order by ID and returns its full details.' },
    ],
    choices: [
      { text: 'Use longer order identifiers and assume they cannot be discovered.', correct: false, why: 'Hard-to-guess identifiers may reduce guessing but cannot authorize access. IDs can still be shared or exposed; the server must check the requested resource.' },
      { text: 'Hide the order page button for customer A.', correct: false, why: 'The request can be sent directly without the button. Interface visibility does not enforce backend ownership or protect returned delivery details.' },
      { text: 'Enforce resource ownership or explicit staff permission before returning order data.', correct: true, why: 'Authorize the verified identity for this exact order on every access path. Return a safe denied/not-found result under the project\'s policy, and test direct cross-customer requests.' },
    ],
    resolution: 'Authentication identifies the caller. Authorization limits which actions that identity may perform on this particular resource. Both must be enforced by trusted server logic.',
  },
];
