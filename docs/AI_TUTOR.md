# AI tutor

Backend Fieldguide includes an optional tutor that answers questions using retrieved material from its 108 lessons. The course remains usable with no provider account. Generating an answer requires internet access and at least one configured OpenRouter, Gemini, Groq or Free.ai key.

Open the tutor at `#tutor`, or use a lesson's **Ask the tutor** link. Ask a specific question, inspect its lesson references, and compare the answer with the lesson. The tutor explains and proposes; it cannot run code, inspect your private repository, access commerce accounts or establish that an integration works.

**Settings → Language** selects English or light Hinglish. Interface labels and technical terms stay English. Hinglish explanations keep mostly English sentences with a few familiar Hindi words written in English letters; the tutor receives the same language preference. The course's bundled translations need no provider request, while submitting a tutor question still calls the configured model.

## Local setup

1. Copy the project's [`.env.example`](../.env.example) to `.env.local` beside `package.json`.
2. Create a key in the provider account you intend to use. Put it in the corresponding server-side key field. Leave unused providers empty.
3. Check the provider's model access, privacy settings and billing limits.
4. Restart `npm run dev`, open the tutor and ask a question such as: “Why must a payment webhook be verified before an order is marked paid?”

The template contains empty credential fields. `.env.local` is ignored by Git. Never place keys in lesson content, screenshots, prompts, issue reports or variables prefixed `NEXT_PUBLIC_`; those public variables can be bundled into browser code. See [Next.js environment-variable guidance](https://nextjs.org/docs/app/guides/environment-variables).

| Variable | Default / behavior |
| --- | --- |
| `AI_PROVIDER_ORDER` | `openrouter,gemini,groq,freeai`; only listed providers with keys are used. |
| `OPENROUTER_API_KEYS` | Empty; comma-separated OpenRouter keys. |
| `OPENROUTER_MODEL` | `openrouter/free`. |
| `GEMINI_API_KEYS` | Empty; comma-separated Gemini keys. |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite`. |
| `GROQ_API_KEYS` | Empty; comma-separated Groq keys. |
| `GROQ_MODEL` | `openai/gpt-oss-20b`, a provider model identifier. |
| `FREEAI_API_KEYS` | Empty; comma-separated Free.ai keys. |
| `FREEAI_MODEL` | `qwen7b`. |
| `TUTOR_ACCESS_CODE` | Empty for local use; required for public, remotely forwarded or Vercel requests. |
| `AI_MAX_OUTPUT_TOKENS` | `1000`; clamped to an integer between 128 and 1600. |

Use a single key or a comma-separated list, with up to **six distinct keys per provider**. Whitespace around keys is removed, duplicate entries are discarded and unused extra entries beyond six are ignored. The singular `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY` and `FREEAI_API_KEY` aliases work when the corresponding plural variable is empty. Prefer one form per provider.

To use only OpenRouter, set `AI_PROVIDER_ORDER=openrouter`. To use Gemini first, set `AI_PROVIDER_ORDER=gemini,openrouter,groq,freeai`. Changing the order or model is an explicit owner decision. Restart the local server after changing configuration.

## Models, cost and availability

`openrouter/free` selects among currently available free models, so answers, latency and availability can vary between requests. Free access has rate limits and does not promise uninterrupted capacity. The application keeps this configured model identifier during retries; it does not silently select a paid OpenRouter model. See the [OpenRouter free router](https://openrouter.ai/docs/guides/routing/routers/free-router).

The configured Gemini default is the stable `gemini-3.5-flash-lite` model documented by Google. Account eligibility, quotas and paid usage depend on the project. Review the [model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) and [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing).

Groq's `openai/gpt-oss-20b` is listed among its production models. Its availability, permissions and charges depend on your Groq organization and plan. Review [Groq's model catalog](https://console.groq.com/docs/models).

Free.ai uses its documented `qwen7b` chat model identifier through `https://api.free.ai/v1/chat/`. Requests consume the account's token balance or applicable free allowance; an exhausted balance can produce `402`. The service name does not promise unlimited or permanently free inference. Check [Free.ai's API plans and billing](https://free.ai/api/).

**Fallback providers may consume paid quota or token balances**, even when the first attempt uses a free OpenRouter model. Configure only providers you intend to use and set account/key spending controls where supported. The output-token limit reduces the size of a response; it is not a total spending cap. OpenRouter supports [per-key credit limits](https://openrouter.ai/docs/api_reference/authentication).

## How retrieval grounds an answer

```mermaid
flowchart LR
  A[Question and recent conversation] --> B[Local tutor API]
  B --> C[Search the course index]
  C --> D[Relevant lesson excerpts]
  D --> E[Configured model provider]
  E --> F[Answer and lesson references]
```

1. The browser submits the question, optional current lesson and recent conversation to `POST /api/tutor`.
2. The server checks the request host/origin, access code, input bounds and local request limits.
3. Deterministic lexical retrieval searches the bundled lesson content and selects up to two relevant excerpts. There is no embedding API, vector database, uploaded document corpus or live web search.
4. The server supplies those excerpts and recent messages to a model with instructions to teach from the course and cite supported claims as `[Lesson N]`.
5. The response includes the answer and the retrieved lesson sources so the learner can inspect the supporting material.

The API uses direct server-side HTTP requests: chat completion requests for OpenRouter and Groq, Free.ai's documented chat endpoint, and Gemini's `generateContent` API. It does not require a provider SDK or give the model executable tools.

If no supporting material is retrieved, the API returns a local explanation asking for a backend topic; that response does not call a provider. A short follow-up can reuse the most recent learner question to find relevant course material.

Retrieval is **grounding, not a correctness guarantee**. Keyword matching may miss a concept or retrieve an imperfect passage, and the model may misinterpret it. A lesson reference identifies retrieved context; it does not prove every sentence in the answer. The tutor does not check today's provider documentation or verify code. Open the sources and perform the lesson's acceptance checks before applying advice.

Useful questions include:

- “Explain order ownership using customer A and customer B. Which layer must enforce it?”
- “A webhook arrived twice. What invariant prevents two stock deductions, and how would I test it?”
- “Give me a precise implementation prompt for a private upload. Include actor, permission rule, failure cases and evidence.”
- “Why does a successful browser payment redirect leave the Fieldstore order pending?”

## Automatic key and provider failover

Here, automatic rotation means selecting from **already configured keys**. The application does not create, revoke, renew or replace provider credentials.

Providers are considered in `AI_PROVIDER_ORDER`. Within each provider, requests start from the next key in a round-robin sequence. Keys with an active cooldown are skipped. Successful attempts also advance the starting position for the next request.

| Result of an attempt | Behavior |
| --- | --- |
| `429` quota/rate limit | Cool down that key and try another eligible key/provider. Default wait is 60 seconds; a valid provider `Retry-After` is honored with a 60-second minimum. |
| `401`, `403` or `402` | Treat as a credential/permission/credit failure; cool down that key for five minutes and try another eligible key/provider. |
| `408`, `500`, `502`, `503`, `504`, network failure, timeout or empty answer | Cool down that key for 30 seconds and try another eligible key/provider. |
| `400`, `404` or `422` | Stop automatic retries and ask the owner to check the configured model/request. Changing keys cannot repair a malformed request. |
| Success | Return the answer; do not contact further providers for that question. |

One tutor request makes at most **four provider attempts**, with a **45-second overall provider budget** and a **12-second timeout per attempt**. A large first-provider key pool can consume the attempt budget before later providers are reached. Exhausting the budget or available keys returns an error; it does not retry indefinitely. Responses are returned as a complete answer rather than a token stream.

Cooldowns and round-robin positions exist only in the running server process. They reset on restart and are not coordinated between multiple instances. Daily quotas may remain exhausted long after a local cooldown ends.

More keys do **not** create more provider capacity: Gemini rate limits are [per project](https://ai.google.dev/gemini-api/docs/rate-limits); Groq limits are [per organization](https://console.groq.com/docs/rate-limits); OpenRouter states that additional accounts or keys do not increase its [rate limits](https://openrouter.ai/docs/api_reference/limits). Failover improves resilience when another configured credential or provider is usable; it does not bypass quotas or spending restrictions.

## Access and request limits

Requests to `localhost`, `127.0.0.1` or loopback IPv6 can run without an access code when `TUTOR_ACCESS_CODE` is empty and forwarded addresses, if present, are loopback addresses. If a code is configured, it is required locally too. Vercel, non-loopback hosts and requests containing a non-loopback `x-forwarded-for` address always require a configured code of at least **16 characters**. Use a private random code no longer than 256 characters and enter it in the tutor's access field.

The browser sends the code in the JSON request body, never the URL. Provider keys are attached only by server code. The tutor accepts requests whose `Origin` host matches the website host, including its port. Requests without that header are rejected.

The supplied run scripts bind the server to `127.0.0.1`. Always configure `TUTOR_ACCESS_CODE` before exposing the server through a network binding, proxy or tunnel, regardless of its hostname: request headers alone cannot establish that a caller is physically local.

The API also limits each server process to **10 accepted requests per minute** and **two concurrent requests**. This is shared across learners using that process, not an independent allowance per learner. These in-memory guards are not distributed rate limiting, individual user accounts or a production billing guarantee.

| Input | Limit |
| --- | --- |
| JSON request body | 32 KiB. |
| Question | 1–2,000 characters. |
| History | At most six `user`/`assistant` entries, each up to 4,000 characters. |
| Lesson context | An existing integer lesson ID, if supplied. |
| Language | `en` or `hinglish`; defaults to `en`. |

`GET /api/tutor` reports whether a provider is configured, provider names and whether an access code is required. It does not expose keys or test account validity, credit balance or model availability.

`POST /api/tutor` accepts `question`, optional `lessonId`, `history`, `language` and `accessCode`. Success returns `answer`, `sources`, `provider` and `model`; failure returns an explanatory `error` and `code`. The returned model is the configured identifier. With `openrouter/free`, it is not the identity of the underlying model selected by the router.

## Privacy and persistence

Submitting a question sends its text, recent conversation, retrieved lesson material and tutor instructions to the selected provider. Automatic fallback can send the same request to another configured provider. No lesson notes, saved progress, workshop drafts, browser storage or repository files are attached automatically. Anything you type or paste into the chat itself is part of the request.

The application keeps tutor conversation and access-code entry in page memory rather than browser storage or progress exports. Reloading starts a new tutor session. The server does not maintain a chat database. It keeps only temporary request counters, key fingerprints/cooldowns and rotation positions for its local guards.

Provider processing and retention policies still apply. Review [OpenRouter data collection](https://openrouter.ai/docs/guides/privacy/data-collection), [Gemini's current terms](https://ai.google.dev/gemini-api/terms), [Groq data controls](https://console.groq.com/docs/your-data) and [Free.ai privacy](https://free.ai/privacy/). Keep secrets and real customer information out of questions. Model output is displayed for review and is not executed.

## Replacing a credential

For routine replacement, create a new provider key with the intended restrictions and spending limit, update `.env.local`, restart, test a harmless course question using that provider, then revoke the previous key in its provider console. Remove the revoked value from the configured list. A suspected exposed key should be revoked promptly. This credential lifecycle is manual and separate from request failover; follow [Google's key management guidance](https://docs.cloud.google.com/docs/authentication/api-keys) and [OpenRouter's authentication guidance](https://openrouter.ai/docs/api_reference/authentication).

## Environment readiness for Vercel

This repository supplies compatible server-side environment-variable names. It does not provision a project, upload credentials or deploy the website.

If the owner later configures their own Vercel project, use the variables above, put provider keys and `TUTOR_ACCESS_CODE` in Secret values, and scope credentials to the intended environment. Keep provider order, model identifiers and token limit as configuration. Do not add `NEXT_PUBLIC_` to any secret. Vercel environment changes apply to new deployments; an existing deployment does not automatically receive a replacement value. See [Vercel environment variables](https://vercel.com/docs/environment-variables).

## Troubleshooting and verification

| Symptom | Check |
| --- | --- |
| Tutor is not configured | Fill one provider's key field, include it in `AI_PROVIDER_ORDER`, and restart. Placeholder values are ignored. |
| Access code required/not configured | Enter the server owner's code; ensure the server value has at least 16 characters. A non-loopback forwarded address requires a code even when a local hostname is involved. |
| Provider credentials/credit error | Check that provider's key validity, restrictions, model permissions and available credit. Replace invalid values server-side. |
| Model configuration error | Check the exact model ID and provider support. A model rejection is not retried with other keys. |
| Rate limited or cooling down | Wait for the provider's reset and reduce request volume. Shared project/account quotas can affect every key. |
| Tutor busy | The local shared minute/concurrency guard was reached; wait before submitting again. |
| No supporting lesson | Name a backend concept, choose a related lesson or restate the question using the course's terminology. |
| Temporary provider failure | Retry later or configure another intended provider. A free router may have limited availability. |

Run `npm test` and `npm run build` for the project's automated checks. Mocked provider tests can establish routing and validation behavior without spending credits; they cannot prove that a real key, quota or model works. Inspect [VERIFICATION.md](VERIFICATION.md) for the checks actually run and any live-integration limits.

Model and provider documentation above was reviewed on **26 October 2026**. Recheck official sources when changing models, pricing assumptions or deployment settings.
