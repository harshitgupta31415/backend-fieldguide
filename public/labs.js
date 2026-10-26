(function () {
  "use strict";

  var mountCount = 0;
  var mounted = new WeakMap();
  var translators = new WeakMap();

  function message(template, values) { return { template: template, values: values || {} }; }
  function translated(panel, value) {
    var translate = translators.get(panel) || function (text) { return text; };
    if (value && typeof value === "object" && typeof value.template === "string") {
      return translate(value.template).replace(/\{([a-zA-Z0-9_]+)\}/g, function (match, key) {
        return Object.prototype.hasOwnProperty.call(value.values, key) ? String(value.values[key]) : match;
      });
    }
    return translate(String(value));
  }

  function translatePanel(panel, translate) {
    translators.set(panel, translate);
    var walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
    var text;
    while ((text = walker.nextNode())) {
      if (text.parentElement && !text.parentElement.closest("code, pre") && text.nodeValue.trim()) text.nodeValue = translate(text.nodeValue);
    }
    panel.querySelectorAll("[aria-label], [title], [placeholder]").forEach(function (element) {
      ["aria-label", "title", "placeholder"].forEach(function (attribute) {
        if (element.hasAttribute(attribute)) element.setAttribute(attribute, translate(element.getAttribute(attribute)));
      });
    });
  }

  function read(panel, selector) {
    return panel.querySelector(selector);
  }

  function write(panel, selector, value) {
    var target = read(panel, selector);
    var isCode = target.matches("pre, code") && typeof value === "string" && /^\s*[\[{]/.test(value);
    target.textContent = isCode ? value : translated(panel, value);
  }

  function showLog(target, entries) {
    target.replaceChildren();
    entries.slice(-8).reverse().forEach(function (entry) {
      var item = document.createElement("li");
      item.textContent = translated(target.closest(".lab-panel"), entry);
      target.appendChild(item);
    });
  }

  function listen(element, eventName, handler) {
    element.addEventListener(eventName, handler);
    return function () { element.removeEventListener(eventName, handler); };
  }

  function actionFrom(event, panel) {
    var element = event.target instanceof Element ? event.target.closest("[data-action]") : null;
    return element && panel.contains(element) ? element.getAttribute("data-action") : null;
  }

  function inventory(container, id, translate) {
    container.innerHTML = `
      <section class="lab-panel" aria-labelledby="${id}-title">
        <span class="pill">Local simulation · inventory</span>
        <h3 id="${id}-title">Who gets the last unit?</h3>
        <p class="lab-note">On-hand means physically present. Reserved includes unpaid holds and paid allocations. Available = on-hand − reserved.</p>
        <div class="lab-grid" aria-label="Inventory quantities">
          <div class="lab-stat"><span>On hand</span><strong data-stat="onhand">10</strong></div>
          <div class="lab-stat"><span>Reserved</span><strong data-stat="reserved">2</strong></div>
          <div class="lab-stat"><span>Available</span><strong data-stat="available">8</strong></div>
          <div class="lab-stat"><span>Unpaid holds</span><strong data-stat="unpaid">2</strong></div>
          <div class="lab-stat"><span>Paid allocations</span><strong data-stat="paid">0</strong></div>
        </div>
        <div class="lab-controls" aria-label="Try an inventory action">
          <button type="button" class="btn" data-action="hold-one">Hold 1 unit</button>
          <button type="button" class="btn" data-action="hold-two">Hold 2 units</button>
          <button type="button" class="btn" data-action="pay">Confirm held units paid</button>
          <button type="button" class="btn" data-action="ship">Ship 1 paid unit</button>
          <button type="button" class="btn secondary" data-action="expire">Expire unpaid holds</button>
          <button type="button" class="btn secondary" data-action="race">Simulate last-unit race</button>
          <button type="button" class="btn secondary" data-action="reset">Reset inventory</button>
        </div>
        <p class="lab-note" data-status role="status" aria-live="polite" aria-atomic="true"></p>
        <p class="lab-note" data-invariant></p>
        <p class="lab-note">Try this: hold 2 → confirm payment → expire unpaid holds → ship 1. Predict which numbers change before each click. These actions only change this simulation.</p>
        <p class="lab-note">The race button starts a synthetic one-unit scenario. It serializes protected claims to model a concurrency rule; it does not run a real database race.</p>
        <h4>Recent events</h4>
        <ol class="event-log" data-log aria-label="Recent inventory events"></ol>
      </section>`;

    var panel = read(container, ".lab-panel");
    translatePanel(panel, translate);
    var state;
    var events;

    function render(message) {
      var reserved = state.unpaid + state.paid;
      var available = state.onHand - reserved;
      write(panel, '[data-stat="onhand"]', state.onHand);
      write(panel, '[data-stat="reserved"]', reserved);
      write(panel, '[data-stat="available"]', available);
      write(panel, '[data-stat="unpaid"]', state.unpaid);
      write(panel, '[data-stat="paid"]', state.paid);
      write(panel, "[data-status]", message);
      write(panel, "[data-invariant]", message("Rules hold: available is {available} (never negative); reserved equals unpaid + paid; expiry releases unpaid holds only.", {available: available}));
      showLog(read(panel, "[data-log]"), events);
    }

    function record(message) {
      events.push(message);
      render(message);
    }

    function reset() {
      state = { onHand: 10, unpaid: 2, paid: 0 };
      events = ["Start: 10 on hand, 2 unpaid holds, 8 available."];
      render("Choose an action. A hold reduces availability; payment keeps the physical count unchanged.");
    }

    function hold(quantity) {
      var available = state.onHand - state.unpaid - state.paid;
      if (quantity > available) {
        record(message("Hold rejected: requested {quantity}, but only {available} available. No quantities changed.", {quantity: quantity, available: available}));
        return;
      }
      state.unpaid += quantity;
      record(message("Held {quantity} units: unpaid holds increased; on-hand stayed {onHand}.", {quantity: quantity, onHand: state.onHand}));
    }

    function click(event) {
      switch (actionFrom(event, panel)) {
        case "hold-one":
          hold(1);
          break;
        case "hold-two":
          hold(2);
          break;
        case "pay":
          if (state.unpaid === 0) {
            record("No unpaid holds to confirm. Payment confirmation cannot allocate the same units again.");
          } else {
            var count = state.unpaid;
            state.paid += count;
            state.unpaid = 0;
            record(message("Confirmed {count} held units paid. Reserved and on-hand are unchanged; paid allocations are protected from unpaid-hold expiry.", {count: count}));
          }
          break;
        case "ship":
          if (state.paid === 0) {
            record("Shipment rejected: no paid allocation is ready. Confirm payment for a held unit first.");
          } else {
            state.paid -= 1;
            state.onHand -= 1;
            record("Shipped 1 paid unit: on-hand and reserved each fell by 1. Availability stayed unchanged.");
          }
          break;
        case "expire":
          if (state.unpaid === 0) {
            record(message("Expiry found no unpaid holds. All {paid} paid allocations remain reserved.", {paid: state.paid}));
          } else {
            var expired = state.unpaid;
            state.unpaid = 0;
            record(message("Expired {expired} unpaid holds: availability increased; on-hand and paid allocations are unchanged.", {expired: expired}));
          }
          break;
        case "race":
          state = { onHand: 1, unpaid: 0, paid: 0 };
          events = ["Synthetic last-unit scenario: 1 on hand, no holds. Previous inventory was replaced for this example."];
          events.push("Shopper A observes 1 available before either protected claim.");
          events.push("Shopper B also observes 1 available before either protected claim.");
          ["A", "B"].forEach(function (shopper) {
            var currentAvailable = state.onHand - state.unpaid - state.paid;
            if (currentAvailable >= 1) {
              state.unpaid += 1;
              events.push(message("Protected claim {shopper} rechecks availability = {available} and reserves 1 unit.", {shopper: shopper, available: currentAvailable}));
            } else {
              events.push(message("Protected claim {shopper} rechecks availability = 0 and rejects the purchase. No second hold is created.", {shopper: shopper}));
            }
          });
          render("Synthetic race: both shoppers read 1, but only A obtains the unit. This local example serializes protected claims to model atomic allocation; it does not execute a database race.");
          break;
        case "reset":
          reset();
          break;
      }
    }

    reset();
    return listen(panel, "click", click);
  }

  function payments(container, id, translate) {
    container.innerHTML = `
      <section class="lab-panel" aria-labelledby="${id}-title">
        <span class="pill">Local simulation · payment events</span>
        <h3 id="${id}-title">A timeout is an unknown result</h3>
        <p class="lab-note">Follow one simulated payment attempt. The provider record and the store record can temporarily disagree. No money moves and no provider is contacted.</p>
        <div class="lab-grid" aria-label="Payment records">
          <div class="lab-stat"><span>Store payment state</span><strong data-stat="local">No attempt</strong></div>
          <div class="lab-stat"><span>Provider truth</span><strong data-stat="provider">Not started</strong></div>
          <div class="lab-stat"><span>Paid transitions</span><strong data-stat="effects">0</strong></div>
        </div>
        <div class="lab-controls" aria-label="Try payment events">
          <button type="button" class="btn" data-action="create">1. Create attempt</button>
          <button type="button" class="btn" data-action="timeout">2. Simulate timeout</button>
          <button type="button" class="btn" data-action="provider-success">3. Provider succeeds</button>
          <button type="button" class="btn" data-action="apply">4. Apply valid webhook</button>
          <button type="button" class="btn secondary" data-action="duplicate">Repeat success event</button>
          <button type="button" class="btn secondary" data-action="stale">Send older failure event</button>
          <button type="button" class="btn secondary" data-action="invalid">Send invalid signature</button>
          <button type="button" class="btn secondary" data-action="reset">Reset payments</button>
        </div>
        <p class="lab-note" data-status role="status" aria-live="polite" aria-atomic="true"></p>
        <p class="lab-note">The example checks signature, attempt, amount, currency, and allowed transition. The signature check is simulated. Real integrations use the provider's documented verifier; authenticated provider lookups can also establish status.</p>
        <h4>Recent events</h4>
        <ol class="event-log" data-log aria-label="Recent payment events"></ol>
      </section>`;

    var panel = read(container, ".lab-panel");
    translatePanel(panel, translate);
    var state;
    var events;
    var accepted;

    function render(message) {
      var localLabels = { none: "No attempt", pending: "Pending", uncertain: "Uncertain", paid: "Paid" };
      var providerLabels = { none: "Not started", pending: "Pending", paid: "Captured" };
      write(panel, '[data-stat="local"]', localLabels[state.local]);
      write(panel, '[data-stat="provider"]', providerLabels[state.provider]);
      write(panel, '[data-stat="effects"]', state.effects);
      write(panel, "[data-status]", message);
      showLog(read(panel, "[data-log]"), events);
    }

    function record(message) {
      events.push(message);
      render(message);
    }

    function reset() {
      state = { local: "none", provider: "none", effects: 0 };
      accepted = new Set();
      events = ["Ready: no payment attempt exists."];
      render("Start with Create attempt, then make a prediction before delivering each event.");
    }

    function needsAttempt() {
      if (state.local !== "none") return true;
      record("Action rejected: create the simulated payment attempt first.");
      return false;
    }

    function successEvent(eventId, validSignature) {
      if (!validSignature) {
        record("Rejected invalid signature before processing. No event was accepted and no payment state changed.");
        return;
      }
      if (!needsAttempt()) return;
      if (state.provider !== "paid") {
        record("No provider success is available yet. Simulate provider success before delivering its success event.");
        return;
      }
      if (accepted.has(eventId)) {
        record(message("Duplicate {eventId} ignored. The stored result is reused; paid transitions remain {effects}.", {eventId: eventId, effects: state.effects}));
        return;
      }
      accepted.add(eventId);
      if (state.local !== "paid") {
        state.local = "paid";
        state.effects += 1;
        record("Verified evt_success_1: matching attempt, amount and currency. Store is Paid; the paid transition happened once.");
      } else {
        record("Success already recorded. Additional verified evidence cannot repeat the paid transition.");
      }
    }

    function click(event) {
      switch (actionFrom(event, panel)) {
        case "create":
          if (state.local === "none") {
            state.local = "pending";
            state.provider = "pending";
            record("Created attempt_demo_1 for 500.00 INR. Store and provider are Pending.");
          } else {
            record("Existing attempt_demo_1 reused. An uncertain or completed operation is not a reason to create another charge.");
          }
          break;
        case "timeout":
          if (!needsAttempt()) break;
          if (state.local === "paid") {
            record("A later client timeout cannot undo verified payment. Store remains Paid.");
          } else {
            state.local = "uncertain";
            record("Response timed out. Store is Uncertain; the provider may still complete the attempt. No replacement charge was created.");
          }
          break;
        case "provider-success":
          if (!needsAttempt()) break;
          if (state.provider === "paid") {
            record("Provider already records capture. No second capture was created.");
          } else {
            state.provider = "paid";
            record("Provider truth is Captured. The store still needs verified evidence before changing its local record.");
          }
          break;
        case "apply":
          successEvent("evt_success_1", true);
          break;
        case "duplicate":
          if (!accepted.has("evt_success_1")) {
            record("Apply the first valid success event before repeating it.");
          } else {
            successEvent("evt_success_1", true);
          }
          break;
        case "stale":
          if (state.local !== "paid") {
            record("First apply the valid success event. This scenario then tests rejection of an older failure notification.");
          } else if (accepted.has("evt_failure_old")) {
            record("Duplicate old failure event ignored. Store remains Paid.");
          } else {
            accepted.add("evt_failure_old");
            record("Signed but stale failure event ignored. Its older state cannot downgrade verified capture; store remains Paid.");
          }
          break;
        case "invalid":
          successEvent("evt_untrusted", false);
          break;
        case "reset":
          reset();
          break;
      }
    }

    reset();
    return listen(panel, "click", click);
  }

  function api(container, id, translate) {
    container.innerHTML = `
      <section class="lab-panel" aria-labelledby="${id}-title">
        <span class="pill">Local simulation · API explorer</span>
        <h3 id="${id}-title">What does the server actually trust?</h3>
        <p class="lab-note">The simulated signed-in customer is customer_demo. The catalog price is 250.00 INR per shirt; 3 units are available. A quote previews amounts while stock and money stay unchanged.</p>
        <div class="lab-controls">
          <label for="${id}-method">Operation
            <select id="${id}-method" data-method>
              <option value="POST">POST · calculate a cart quote</option>
              <option value="GET">GET · read the saved demo cart</option>
            </select>
          </label>
          <label for="${id}-owner">Target cart
            <select id="${id}-owner" data-owner>
              <option value="mine">Your cart</option>
              <option value="other">Another customer's cart</option>
            </select>
          </label>
          <label for="${id}-quantity">Requested quantity
            <input id="${id}-quantity" data-quantity type="text" inputmode="numeric" value="2" maxlength="12" autocomplete="off" aria-describedby="${id}-quantity-help">
          </label>
          <label for="${id}-tamper">
            <input id="${id}-tamper" data-tamper type="checkbox" checked>
            Send a tampered browser price of 1.00 INR
          </label>
        </div>
        <p id="${id}-quantity-help" class="lab-note">For POST, try 0, 1.5, 4, or 2. Quantity must be a whole number from 1 to 5; current stock allows up to 3.</p>
        <div class="lab-controls">
          <button type="button" class="btn" data-action="send">Send simulated request</button>
          <button type="button" class="btn secondary" data-action="reset">Reset API lab</button>
        </div>
        <p class="lab-note" data-status role="status" aria-live="polite" aria-atomic="true"></p>
        <div class="lab-grid">
          <div><h4>Browser request</h4><pre class="lab-code" data-request aria-label="Simulated browser request"></pre></div>
          <div><h4>Server response <span class="pill" data-http>Not sent</span></h4><pre class="lab-code" data-response aria-label="Simulated server response">Send a request to inspect the result.</pre></div>
        </div>
        <h4>Server trace</h4>
        <ol class="event-log" data-trace aria-label="Steps in the most recent simulated request"></ol>
        <p class="lab-note">Every value supplied by the browser is untrusted. Identity comes from a verified session; ownership comes from stored records; prices come from the catalog. This lab uses local fixtures and makes no network calls.</p>
      </section>`;

    var panel = read(container, ".lab-panel");
    translatePanel(panel, translate);
    var method = read(panel, "[data-method]");
    var owner = read(panel, "[data-owner]");
    var quantity = read(panel, "[data-quantity]");
    var tamper = read(panel, "[data-tamper]");

    function cartId() { return owner.value === "mine" ? "cart_demo" : "cart_other"; }

    function numericQuantity() {
      var value = quantity.value.trim();
      return /^\d+$/.test(value) ? Number(value) : value;
    }

    function request() {
      var operation = method.value;
      var result = {
        method: operation,
        path: "/api/carts/" + cartId() + (operation === "POST" ? "/quote" : "")
      };
      if (operation === "POST") {
        result.body = {
          variant_id: "shirt_blue_m",
          quantity: numericQuantity(),
          browser_unit_price_minor: tamper.checked ? 100 : 25000,
          currency: "INR"
        };
      }
      return result;
    }

    function updatePreview() {
      var isRead = method.value === "GET";
      quantity.disabled = isRead;
      tamper.disabled = isRead;
      write(panel, "[data-request]", JSON.stringify(request(), null, 2));
    }

    function respond(status, reason, data, trace, message) {
      write(panel, "[data-http]", String(status) + " " + reason);
      write(panel, "[data-response]", JSON.stringify(data, null, 2));
      write(panel, "[data-status]", message);
      // This trace is chronological; event histories in the other labs show newest first.
      var target = read(panel, "[data-trace]");
      target.replaceChildren();
      trace.forEach(function (entry) {
        var item = document.createElement("li");
        item.textContent = translated(target.closest(".lab-panel"), entry);
        target.appendChild(item);
      });
    }

    function send() {
      updatePreview();
      var req = request();
      var trace = [
        message("Route {method} {path}.", {method: req.method, path: req.path}),
        "Verify the simulated session: identity is customer_demo.",
        "Load the target cart and check its stored owner."
      ];
      if (owner.value !== "mine") {
        trace.push("Ownership does not match. Stop before reading private items or calculating a quote.");
        respond(403, "Forbidden", { error: { code: "CART_FORBIDDEN", message: "You cannot access this cart." } }, trace,
          "403: signing in does not grant access to another customer's cart.");
        return;
      }

      trace.push("Ownership check passed.");
      if (req.method === "GET") {
        trace.push("Read the saved demo cart and return only permitted fields.");
        respond(200, "OK", {
          cart_id: "cart_demo",
          items: [{ variant_id: "shirt_blue_m", quantity: 2 }],
          currency: "INR"
        }, trace, "200: returned your saved demo cart. GET ignores the quote controls.");
        return;
      }

      var count = numericQuantity();
      if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 1 || count > 5) {
        trace.push("Quantity validation failed: require a whole number from 1 to 5.");
        respond(422, "Unprocessable Content", { error: { code: "INVALID_QUANTITY", message: "Quantity must be a whole number from 1 to 5." } }, trace,
          "422: the server rejected invalid quantity input. Browser controls do not replace server validation.");
        return;
      }
      trace.push("Quantity shape and allowed range passed.");
      if (count > 3) {
        trace.push("Current availability is 3; the requested quantity cannot be quoted as available.");
        respond(409, "Conflict", { error: { code: "QUANTITY_UNAVAILABLE", message: "Only 3 units are currently available." } }, trace,
          "409: quantity is well formed, but current stock cannot support it.");
        return;
      }
      trace.push("Load authoritative catalog price: 25000 minor units per item, currency INR.");
      trace.push(message("Ignore browser_unit_price_minor; calculate {count} × 25000 on the server.", {count: count}));
      trace.push("Return a quote only. No stock is reserved, order created, or payment attempted.");
      respond(200, "OK", {
        status: "quoted",
        cart_id: "cart_demo",
        line: { variant_id: "shirt_blue_m", quantity: count, unit_price_minor: 25000, line_total_minor: count * 25000 },
        subtotal_minor: count * 25000,
        currency: "INR",
        stock_reserved: false
      }, trace, message("200: trusted subtotal is {amount} INR. The browser's submitted price did not set the amount.", {amount: (count * 250).toFixed(2)}));
    }

    function reset() {
      method.value = "POST";
      owner.value = "mine";
      quantity.value = "2";
      tamper.checked = true;
      updatePreview();
      write(panel, "[data-http]", "Not sent");
      write(panel, "[data-response]", "Send a request to inspect the result.");
      write(panel, "[data-status]", "Try a tampered price, then invalid quantity or another customer's cart. Compare the server trace.");
      read(panel, "[data-trace]").replaceChildren();
    }

    function click(event) {
      var action = actionFrom(event, panel);
      if (action === "send") send();
      if (action === "reset") reset();
    }

    var removeClick = listen(panel, "click", click);
    var removeChange = listen(panel, "change", updatePreview);
    var removeInput = listen(panel, "input", updatePreview);
    reset();
    return function () {
      removeClick();
      removeChange();
      removeInput();
    };
  }

  var factories = { inventory: inventory, payments: payments, api: api };

  function mount(container, labName, translate) {
    translate = typeof translate === "function" ? translate : function (text) { return text; };
    if (!container || typeof container.querySelector !== "function") {
      throw new TypeError("BackendLabs.mount needs a container element.");
    }
    if (!Object.prototype.hasOwnProperty.call(factories, labName)) {
      throw new Error("Unknown backend lab: " + String(labName));
    }
    var previous = mounted.get(container);
    if (previous) previous();
    mountCount += 1;
    var cleanup = factories[labName](container, "backend-lab-" + mountCount, translate);
    var active = true;
    var dispose = function () {
      if (!active) return;
      active = false;
      cleanup();
      if (mounted.get(container) === dispose) mounted.delete(container);
    };
    mounted.set(container, dispose);
    return dispose;
  }

  window.BackendLabs = Object.freeze({
    mount: mount,
    names: Object.freeze(["inventory", "payments", "api"])
  });
})();

