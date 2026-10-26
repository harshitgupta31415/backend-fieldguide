import test from 'node:test';
import assert from 'node:assert/strict';
import { initialBooking, bookingTransition, initialPayment, paymentTransition, initialNotification, notificationTransition, authorizeOrder, initialReturn, returnTransition, validateEnvironment } from '../lib/simulations.mjs';

test('a booking timeout is reconciled to one shipment even after retries',()=>{
  let state=bookingTransition(initialBooking,'book');
  assert.equal(state.status,'unknown');assert.equal(state.providerBookings,1);
  state=bookingTransition(state,'book');assert.equal(state.providerBookings,1);assert.equal(state.status,'unknown');
  state=bookingTransition(state,'lookup');state=bookingTransition(state,'book');
  assert.equal(state.status,'booked');assert.equal(state.providerBookings,1);assert.equal(state.providerId,'shipment_demo_104');assert.ok(state.recovered&&state.duplicateGuarded);
});
test('browser success and mismatched evidence never mark a payment paid',()=>{
  let state=paymentTransition(initialPayment,'browser');state=paymentTransition(state,'invalid');
  assert.equal(state.payment,'unverified');assert.equal(state.effects,0);
  state=paymentTransition(state,'verified');state=paymentTransition(state,'verified');
  assert.equal(state.effects,1);assert.ok(state.duplicateGuarded);assert.equal(state.bank,'not reconciled');
  state=paymentTransition(state,'settle');assert.equal(state.bank,'reconciled');
});
test('five repeated order events produce one submission; acceptance is not delivery',()=>{
  let state=initialNotification;
  for(let i=0;i<5;i++)state=notificationTransition(state,'event');
  assert.equal(state.events,5);assert.equal(state.submissions,1);assert.equal(state.delivery,'accepted');
  state=notificationTransition(state,'bounce');assert.equal(state.delivery,'bounced');
  state=notificationTransition(state,'event');assert.equal(state.submissions,1);assert.equal(state.delivery,'bounced');
});
test('a browser admin claim cannot read or modify another customer order',()=>{
  for(const operation of ['read','update'])assert.deepEqual(Object.values(authorizeOrder({customer:'A',owner:'B',operation,clientAdmin:true})).slice(0,2),[403,0]);
  assert.equal(authorizeOrder({customer:'A',owner:'A',operation:'update',clientAdmin:false}).changed,1);
});
test('stock cannot be released before return inspection or added twice',()=>{
  let state=returnTransition(initialReturn,'restock');assert.equal(state.onHand,0);
  for(const action of ['reattempt','rto','receive','restock'])state=returnTransition(state,action);
  assert.equal(state.onHand,0);
  for(const action of ['inspect','restock','restock','refund'])state=returnTransition(state,action);
  assert.equal(state.onHand,1);assert.equal(state.refund,'approved; provider confirmation pending');assert.equal(state.payment,'captured');
});
test('an uncollected COD return does not create a refund obligation in the example',()=>{
  let state=returnTransition(initialReturn,'cod');
  for(const action of ['reattempt','rto','receive','inspect','restock','refund'])state=returnTransition(state,action);
  assert.equal(state.payment,'COD not collected');assert.equal(state.refund,'not due; no collection');assert.equal(state.onHand,1);
});
test('test configuration rejects production data and publicly prefixed credentials',()=>{
  assert.ok(validateEnvironment({database:'production',secretName:'NEXT_PUBLIC_PAYMENT_SECRET',callback:'production'}).every(result=>!result.ok));
  assert.ok(validateEnvironment({database:'test',secretName:'PAYMENT_SECRET',callback:'local'}).every(result=>result.ok));
});
