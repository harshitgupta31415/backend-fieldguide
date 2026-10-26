# AI tutor

Backend Fieldguide includes an optional tutor that answers questions using retrieved material from its 108 lessons. The course remains usable with no provider account. Generating an answer requires internet access and at least one configured OpenRouter, Gemini, Groq or Free.ai key.

Open the tutor dock from any page, `#tutor`, or a lesson's **Ask the tutor** link. The dock stays mounted while you browse, keeping your conversation beside the lesson. Resize, expand, minimize or close it; on small screens it opens as a drawer. Ask a specific question, inspect its references, and compare the answer with the lesson. The tutor explains and proposes; it cannot run code, inspect your private repository, access commerce accounts or establish that an integration works.

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
| `code` | Exact lowercase name. A private 16–256 character access password; required for public, remotely forwarded or Vercel requests. Setting it protects local requests too. |
| `TUTOR_ACCESS_CODE` | Legacy fallback used only when `code` is empty or absent. |
| `AI_MAX_OUTPUT_TOKENS` | `1000`; clamped to an integer between 128 and 1600. |

Use a single key or a comma-separated list, with up to **six distinct keys per provider**. Whitespace around keys is removed, duplicate entries are discarded and unused extra entries beyond six are ignored. The singular `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY` and `FREEAI_API_KEY` aliases work when the corresponding plural variable is empty. Prefer one form per provider.

To use only OpenRouter for chat, set `AI_PROVIDER_ORDER=openrouter`. To use Gemini first, set `AI_PROVIDER_ORDER=gemini,openrouter,groq,freeai`. Changing the order or model is an explicit owner decision. Restart the local server after changing configuration. Audio uses `GROQ_API_KEYS` independently of chat order; it needs no additional environment variables.

## Teaching modes and your course copy

The desktop tutor starts as a 600-pixel side chat. Use **Full chat** for a centered workspace up to 960 pixels wide, or adjust the side width between 480 and 800 pixels. Screens up to 1,000 pixels use the full viewport. Messages scroll independently while the composer and **Send** remain visible. Open **Settings** beside the lesson title to select the lesson, follow navigation, enter a required access code or check the connection. Minimize and reopen without losing the conversation.

- **Explain:** one concept, a store example and a question to check understanding.
- **Quiz me:** a prediction question, then feedback after your attempt.
- **Practice:** a small task with a prediction or evidence to discuss.
- **Plan:** a manageable next step; request course changes explicitly when wanted.

These are teaching instructions to the model, not a guaranteed assessment of mastery. The request includes the current lesson, a small completion summary and the current lesson-title registry so advice can fit your course copy.

Ask, for example, “Add a short lesson about duplicate webhook handling to this part,” or “Improve this lesson's example.” The response can contain an **add**, **edit** or **move** proposal. Inspect the teaching content and placement in **Review**, then choose **Apply**. Only that click changes your local copy. The model cannot modify source files, execute code or publish anything.

The **Edit course** workspace offers manual add/edit/reorder, course-only export/import, and undo for the **last five course changes**. A copy permits **50 added lessons**, **100 edited lessons**, and ordering within the same part. Added lessons receive local IDs and contribute to local totals. The original 108-lesson source remains intact. Personal additions and edits are labeled unverified content when supplied to the tutor; review their facts, quizzes and checks before teaching from them.

Course changes persist in browser storage and are included in progress exports. Course-only files use `backend-fieldguide-course.json`; importing replaces local course changes rather than merging copies. Chat messages, unapplied proposals and access-code entry are not included. Keep an export before replacing a copy or clearing browser storage.

Applying edits to a quiz, exercise, teaching answer or completion checks clears the lesson's previous pass/check/completion records. Revisit the updated checks. Course undo restores content, not cleared assessment records.

## Voice input and read aloud

**Input:** open **Voice input**, then choose **Record question** to request microphone permission. Stop within 60 seconds, preview or discard the recording, then explicitly choose **Transcribe**. The transcript fills the question box for review; submitting the tutor question is a separate action. The app caps recordings at **5 MB** and rejects unsupported formats. It sends the recording to Groq only for transcription, keeps no recording database or local-storage audio, and releases microphone tracks when stopped or hidden. Browser microphone support and permission are required.

Transcription uses Groq's multilingual `whisper-large-v3-turbo` at `/audio/transcriptions`. English mode supplies an English language hint; Hinglish mode leaves language detection automatic with a short terminology hint. Recognition and Roman-script spelling are not guaranteed, so edit the transcript before sending. A provider-reported recording longer than the limit is rejected. See [Groq speech-to-text](https://console.groq.com/docs/speech-to-text).

**Output:** choose **Read aloud** on a completed answer. Natural speech uses Groq's English `canopylabs/orpheus-v1-english` model with the **Hannah** voice and WAV audio. It is a preview model, so availability can change. The app reads up to **2,000 characters**, omits fenced code, and splits text into requests of at most **200 characters** to match the provider limit, then joins compatible PCM WAV chunks. Long answers require multiple provider calls and may reach the time limit. See [Orpheus speech documentation](https://console.groq.com/docs/text-to-speech/orpheus) and its [model page](https://console.groq.com/docs/model/canopylabs/orpheus-v1-english).

**Model setup:** Groq can return `model_terms_required` until an organization administrator reviews and accepts the Orpheus terms in [Groq model setup](https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english). When this happens, the app shows a fixed official setup link and a Browser voice option. It does not accept legal terms, retry other keys for this setup error, or expose the provider's raw error details. Natural voice remains unavailable until the account owner completes any required setup; browser speech does not need that acceptance.

Pause, resume, replay or stop playback. Only one answer/recording preview plays at a time. Closing or minimizing the tutor stops playback, recording and pending audio requests. Audio never starts without a Read aloud or Play action.

Choose **Browser voice** for the normal device/browser option, including when natural speech is unavailable. It uses the browser's available voices and needs no app provider key; some browser voices may use an online speech service. Voice availability, naturalness and Hindi pronunciation vary by device. Groq's natural voice is English, so Hinglish pronunciation may be imperfect. See [browser speech synthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis).

Audio routes use the same origin and access-code policy as the tutor. They share a separate in-process limit of **eight audio actions per minute** and **two concurrent actions**. Groq keys rotate independently of chat, with up to two eligible-key attempts per transcription or speech chunk, a 12-second attempt timeout and 45-second overall provider budget. Credentials/quota/temporary failures cool down keys; audio does not fall back to another vendor. Browser voice remains an explicit user choice. Groq charges and provider retention policies apply to uploaded audio and generated speech.

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

1. The browser submits the question, teaching mode, optional current lesson, recent conversation, small completion summary and course registry to `POST /api/tutor`, plus up to six bounded excerpts from personal lessons.
2. The server checks the request host/origin, access code, input bounds and local request limits.
3. Deterministic lexical retrieval searches the bundled lesson content and selects up to two relevant excerpts. Relevant supplied personal excerpts can replace or supplement authored material and are labeled unverified. There is no embedding API, vector database, uploaded document corpus or live web search.
4. The server supplies those excerpts and recent messages to a model with instructions to teach from the course and cite supported claims as `[Lesson N]`.
5. The response includes the answer, lesson sources and any validated course-change proposals. Proposals require review and Apply in the browser.

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

Requests to `localhost`, `127.0.0.1` or loopback IPv6 can run without an access code when both `code` and the legacy `TUTOR_ACCESS_CODE` are empty and forwarded addresses, if present, are loopback addresses. A nonempty lowercase `code` takes precedence over the legacy variable. If a code is configured, it is required locally too. Vercel, non-loopback hosts and requests containing a non-loopback `x-forwarded-for` address always require a configured code of **16–256 characters**. Enter the same value in the app's access field. The server checks it without exposing the configured password in status responses or filling the field automatically.

For a local environment file, use `code=your-private-access-password` and restart the server. In Vercel, set the variable name to `code` and its value to the password alone, then use a new deployment for the changed environment. `something` illustrates the value position; the literal eight-character value does not meet the minimum length.

The browser sends the code in the request body (JSON for chat/read aloud, multipart for transcription), never the URL. Provider keys are attached only by server code. The APIs accept requests whose `Origin` host matches the website host, including its port. Requests without that header are rejected.

The supplied run scripts bind the server to `127.0.0.1`. Always configure `code` before exposing the server through a network binding, proxy or tunnel, regardless of its hostname: request headers alone cannot establish that a caller is physically local.

The API also limits each server process to **10 accepted requests per minute** and **two concurrent requests**. This is shared across learners using that process, not an independent allowance per learner. These in-memory guards are not distributed rate limiting, individual user accounts or a production billing guarantee.

| Input | Limit |
| --- | --- |
| Tutor JSON request body | 64 KiB. |
| Question | 1–2,000 characters. |
| History | At most six `user`/`assistant` entries, each up to 4,000 characters. |
| Lesson context | An existing integer lesson ID, if supplied. |
| Language | `en` or `hinglish`; defaults to `en`. |
| Teaching mode | `explain`, `quiz`, `practice` or `plan`; defaults to `explain`. |
| Course context | Registry of the original 108 lessons and up to 50 additions; up to six bounded personal excerpts. |

`GET /api/tutor` reports whether a provider is configured, provider names and whether an access code is required. It does not expose keys or test account validity, credit balance or model availability.

`POST /api/tutor` accepts `question`, optional `lessonId`, `history`, `language`, `intent`, `learnerSummary`, `courseContext` and `accessCode`. Success returns `answer`, `sources`, `actions`, `warnings`, `provider` and `model`; failure returns an explanatory `error` and `code`. The returned model is the configured identifier. With `openrouter/free`, it is not the identity of the underlying model selected by the router.

`POST /api/voice/transcribe` accepts multipart `file`, `durationMs`, `language` and `accessCode`; it returns `text`, `truncated` and `provider`. `GET` reports configuration/limits without keys. `POST /api/voice/speak` accepts JSON `text`, `language` and `accessCode` and returns `audio/wav`. Voice errors use explanatory `error` and `code` values without upstream error bodies.

## Privacy and persistence

Submitting a question sends its text, recent conversation, retrieved lesson material, current course registry (titles/IDs/order), a small completion summary and tutor instructions to the selected provider. Supplied excerpts from your edited/added lessons may be selected as context. Automatic fallback can send the same request to another configured provider. Lesson notes, workshop drafts, the full progress record and repository files are not attached automatically. Anything typed or pasted into chat is part of the request. Transcribe sends your audio to Groq; natural Read aloud sends the prepared answer text to Groq. Browser voice processing depends on the browser's chosen service.

The application keeps conversation, unapplied proposals, access-code entry and audio in page memory rather than progress exports. Chat survives course navigation and hiding the dock; reloading clears it. Applied course changes are different: they persist in the local course copy. The server keeps no chat/audio database; its request processing and rate-limit/rotation state are temporary.

Provider processing and retention policies still apply. Review [OpenRouter data collection](https://openrouter.ai/docs/guides/privacy/data-collection), [Gemini's current terms](https://ai.google.dev/gemini-api/terms), [Groq data controls](https://console.groq.com/docs/your-data) and [Free.ai privacy](https://free.ai/privacy/). Keep secrets and real customer information out of questions. Model output is displayed for review and is not executed.

## Replacing a credential

For routine replacement, create a new provider key with the intended restrictions and spending limit, update `.env.local`, restart, test a harmless course question using that provider, then revoke the previous key in its provider console. Remove the revoked value from the configured list. A suspected exposed key should be revoked promptly. This credential lifecycle is manual and separate from request failover; follow [Google's key management guidance](https://docs.cloud.google.com/docs/authentication/api-keys) and [OpenRouter's authentication guidance](https://openrouter.ai/docs/api_reference/authentication).

## Environment readiness for Vercel

This repository supplies compatible server-side environment-variable names. It does not provision a project, upload credentials or deploy the website.

If the owner later configures their own Vercel project, use the variables above, put provider keys and `code` in Secret values, and scope credentials to the intended environment. Keep provider order, model identifiers and token limit as configuration. Do not add `NEXT_PUBLIC_` to any secret. Vercel environment changes apply to new deployments; an existing deployment does not automatically receive a replacement value. See [Vercel environment variables](https://vercel.com/docs/environment-variables).

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
| Microphone unavailable | Use localhost/HTTPS, check browser permission and microphone hardware, or type the question. |
| Natural voice unavailable | Check the server-side Groq key/model access; choose Browser voice as an explicit alternative. |
| Orpheus model terms required | A Groq organization administrator must review the terms in Groq model setup. The app cannot accept them; Browser voice remains available. |
| Long read-aloud times out | Read a shorter answer or use Browser voice; natural speech needs multiple 200-character provider calls. |
| Course proposal cannot apply | Review required lesson fields, same-part placement and local copy size/count limits; refresh stale proposals. |

Run `npm test` and `npm run build` for the project's automated checks. Mocked provider tests can establish routing and validation behavior without spending credits; they cannot prove that a real key, quota or model works. Inspect [VERIFICATION.md](VERIFICATION.md) for the checks actually run and any live-integration limits.

Model and provider documentation above was reviewed on **26 October 2026**. Recheck official sources when changing models, pricing assumptions or deployment settings.

Course-only imports accept up to 5 MB; full progress imports accept up to 16 MB, including bounded notes and Unicode text. Replacing a different custom lesson that happens to use the same ID clears its old notes and assessment credit. Export your current progress first when you want to preserve that prior copy.
