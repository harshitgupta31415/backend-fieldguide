// Small deterministic teaching models. No provider, database, or network calls.
export const initialBooking = { status: 'idle', providerBookings: 0, providerId: null, recovered: false, duplicateGuarded: false, message: 'Order FS-104 is ready for a synthetic booking.' };
export function bookingTransition(state, action) {
  if (action === 'book') {
    if (state.providerBookings) return { ...state, duplicateGuarded: true, message: state.status === 'unknown' ? 'Outcome uncertain. A new booking is blocked; look up the original operation first.' : 'Existing shipment recovered for the same order. No second booking.' };
    return { ...state, status: 'unknown', providerBookings: 1, providerId: 'shipment_demo_104', message: 'The synthetic provider created a shipment, but the response timed out. The app must not assume failure.' };
  }
  if (action === 'lookup') {
    if (!state.providerBookings) return { ...state, message: 'There is no attempted booking to reconcile yet.' };
    return { ...state, status: 'booked', recovered: true, message: 'Lookup matched order FS-104 to shipment_demo_104. Store the mapping before any retry. AWB_DEMO_104 is a fake teaching label.' };
  }
  return state;
}

export const initialPayment = { browser: 'waiting', payment: 'unverified', bank: 'not reconciled', effects: 0, duplicateGuarded: false, message: 'Trusted total: INR 250.00 (25000 minor units).' };
export function paymentTransition(state, action) {
  if (action === 'browser') return { ...state, browser: 'success screen', message: 'The browser reports success. The order remains processing until server verification establishes the payment outcome.' };
  if (action === 'invalid') return { ...state, message: 'Rejected: event amount 100 does not match the server order total 25000. No paid transition.' };
  if (action === 'verified') return state.payment === 'captured' ? { ...state, duplicateGuarded: true, message: 'Same verified operation, already applied. Acknowledge without repeating the payment effect.' } : { ...state, payment: 'captured', effects: 1, message: 'Synthetic signature, association, amount, currency, and transition checks passed. Mark paid once; settlement is still separate.' };
  if (action === 'settle') return state.payment === 'captured' ? { ...state, bank: 'reconciled', message: 'Synthetic settlement evidence matched the ledger. Capture alone did not prove a bank payout.' } : { ...state, message: 'No verified captured payment to reconcile.' };
  return state;
}

export const initialNotification = { events: 0, submissions: 0, delivery: 'not sent', message: 'No order confirmation has been requested.' };
export function notificationTransition(state, action) {
  if (action === 'event') return { ...state, events: state.events + 1, submissions: 1, delivery: state.submissions ? state.delivery : 'accepted', message: state.submissions ? 'The durable key order:FS-104:confirmation:email already exists. Do not send again.' : 'One notification record and one synthetic provider acceptance. Acceptance is not evidence of inbox delivery.' };
  if (['deliver','bounce'].includes(action) && state.submissions && state.delivery !== 'accepted') return { ...state, message: 'This teaching event already has a terminal outcome. Ignore repeated effects; real providers require documented event ordering and reconciliation rules.' };
  if (action === 'deliver' && state.submissions) return { ...state, delivery: 'delivered', message: 'A synthetic delivery event advances delivery status. It does not prove the customer read the message.' };
  if (action === 'bounce' && state.submissions) return { ...state, delivery: 'bounced', message: 'Record the bounce and investigate the address or provider response. Replaying the order event is not an appropriate retry policy.' };
  return state;
}

export function authorizeOrder({ customer, owner, operation, clientAdmin }) {
  const allowed = customer === owner;
  return { status: allowed ? 200 : 403, changed: allowed && operation === 'update' ? 1 : 0, message: allowed ? 'Verified customer owns this order. This simplified policy allows the requested read/update.' : `Denied before returning or changing another customer’s record.${clientAdmin ? ' The browser’s admin claim has no authority.' : ''}` };
}

export const initialReturn = { shipping: 'delivery failed', payment: 'captured', refund: 'not reviewed', stock: 'shipped', onHand: 0, quarantined: 0, inspected: false, message: 'Fieldstore starts with one shipped unit and a failed delivery. All values are synthetic.' };
export function returnTransition(state, action) {
  if (action === 'reattempt' && state.shipping === 'delivery failed') return { ...state, shipping: 'reattempt failed', message: 'A reattempt also failed. Review the NDR and choose the documented return-to-origin process.' };
  if (action === 'rto' && state.shipping === 'reattempt failed') return { ...state, shipping: 'return in transit', message: 'Return initiated. Stock is not available until receipt and inspection.' };
  if (action === 'receive' && state.shipping === 'return in transit') return { ...state, shipping: 'received at warehouse', stock: 'quarantined', quarantined: 1, message: 'Received into a separate quarantine pool. Keep the unit out of fulfillment stock until inspection.' };
  if (action === 'inspect' && state.shipping === 'received at warehouse' && !state.inspected) return { ...state, inspected: true, stock: 'inspected sellable', message: 'Synthetic inspection: the shirt is sellable. A separate guarded stock operation may release it.' };
  if (action === 'restock') return state.inspected && !state.onHand ? { ...state, stock: 'restocked', onHand: 1, quarantined: 0, message: 'Transfer one inspected unit from quarantine to fulfillment on-hand stock. Repeated clicks have no extra stock effect.' } : { ...state, message: state.onHand ? 'Already restocked: duplicate operation ignored.' : 'Blocked: inspection must establish sellable condition first.' };
  if (action === 'refund') return state.shipping === 'received at warehouse' ? { ...state, refund: state.payment === 'captured' ? 'approved; provider confirmation pending' : 'not due; no collection', message: state.payment === 'captured' ? 'Policy review approved a refund for the captured payment. Approval is not provider confirmation of a refund.' : 'This COD parcel was never delivered or collected. No refund of uncollected funds; reconcile the courier ledger.' } : { ...state, message: 'For this example policy, review after returned goods are received. Real refund policies must be explicitly agreed.' };
  if (action === 'cod' && state.shipping === 'delivery failed') return { ...state, payment: 'COD not collected', message: 'COD collection and courier remittance are separate. This failed delivery collected nothing.' };
  return state;
}

export function validateEnvironment(values) {
  return [
    { ok: values.database === 'test', text: 'The test app must connect to an isolated test database.' },
    { ok: values.secretName === 'PAYMENT_SECRET', text: 'Payment credentials must use a server-only variable name; NEXT_PUBLIC_ exposes values to browser code.' },
    { ok: values.callback === 'local', text: 'This local exercise needs its exact allowlisted local callback URL.' },
  ];
}
