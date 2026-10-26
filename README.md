# Backend Fieldguide

An interactive ecommerce backend course by [harshitgupta31415](https://github.com/harshitgupta31415).

Understand what happens behind the storefront, connect the services, investigate failures, and guide AI with precise instructions. **28 parts · 108 lessons · 16 practical missions · 3 games · 3 labs.**

![Backend Fieldguide learning interface](docs/preview.png)

Designed for learners who already understand their intended UI/UX and want to understand the backend well enough to direct, inspect and verify its implementation. You can start without memorizing syntax. The course teaches responsibilities, data, permissions, money, stock, failure recovery and evidence.

The original **60 foundation lessons and their IDs are preserved**. The expansion adds **48 practical lessons**. Seven optional advanced tracks suggest further study beyond the single-store foundation; they are not counted as completed lessons.

[Full curriculum](docs/CURRICULUM.md) · [Fieldstore capstone](docs/CAPSTONE.md) · [AI tutor setup](docs/AI_TUTOR.md) · [Verification record](docs/VERIFICATION.md)

## Run locally

Install Git, npm and a **supported Node.js LTS release that meets the project's Node.js 22.12.0 minimum**. Check the [official release schedule](https://nodejs.org/en/about/previous-releases) when choosing a runtime. Provider exercises must also match the versions installed in the project being inspected.

```sh
git clone https://github.com/harshitgupta31415/backend-fieldguide.git
cd backend-fieldguide
npm ci
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

The **course, games and simulations work without API keys or provider accounts**. The optional AI tutor needs a server-side provider key and internet access. Dependency installation and external reference links also need internet access. The server binds to `127.0.0.1`; this repository is for running the course locally.

To run a production build on your own computer, stop the development server and run:

```sh
npm run build
npm start
```

This starts a local production server. It does not deploy or host the website.

## Optional AI tutor

Ask a backend question from the tutor page (`#tutor`) or a lesson's **Ask the tutor** link. The server retrieves relevant excerpts from the 108 lessons, sends them with your question to a configured model, and returns an explanation with lesson references. Retrieval uses a local keyword index; no vector database or embedding service is required. Read the cited lessons and verify implementation advice: grounding does not guarantee a correct answer.

1. Copy [`.env.example`](.env.example) to `.env.local` in the project root.
2. Add your own key to `OPENROUTER_API_KEYS`, `GEMINI_API_KEYS` or `GROQ_API_KEYS`. Leave unused providers empty. Each accepts up to six comma-separated keys.
3. Restart the local server, open the tutor and ask a course question.

The default provider order is **OpenRouter → Gemini → Groq**. OpenRouter uses `openrouter/free`, whose available models and limits vary. Gemini and Groq fallback can incur charges under your account's plan; configure only providers you intend to use. Review [OpenRouter's free router](https://openrouter.ai/docs/guides/routing/routers/free-router), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) and [Groq models and pricing](https://console.groq.com/docs/models).

Automatic failover tries another configured key/provider after quota, credential or temporary service errors. It does not create keys or increase shared provider quotas. Keys stay on the server; never use a `NEXT_PUBLIC_` prefix. A shared `TUTOR_ACCESS_CODE` of at least 16 characters is required outside direct localhost access, including Vercel. The checked-in template contains no credentials.

Tutor questions, recent conversation and retrieved excerpts are sent to the selected provider. Course notes, progress and prompt drafts are not attached. Tutor conversation and access-code entry stay in page memory and are not included in progress exports. See [AI_TUTOR.md](docs/AI_TUTOR.md) for configuration, request limits, privacy, failover and troubleshooting.

## The learning experience

- **A visual path:** foundation and practical tracks, a next-lesson card, progress indicators and milestones.
- **Four steps per lesson:** Understand → Explore → Solve → Apply.
- **Clickable explanations:** diagram nodes, store examples, common mistakes, debugging clues and implementation examples.
- **Seven AI prompt modes:** Understand, Inspect, Plan, Implement, Debug, Verify and Review, customized to the topic.
- **Optional course tutor:** ask follow-up questions using retrieved lesson excerpts and OpenRouter, Gemini or Groq.
- **Learning checks:** solve the prediction question and complete three practical self-checks before marking a new lesson complete.
- **Practice Studio:** sixteen missions using diagnosis, ordering, sorting, configuration decisions and local simulations, ending in the connected capstone.
- **Backend Arcade:** Request relay, Boundary keeper and Incident detective, with feedback and replay.
- **Three labs:** inventory/reservations, payments/retries and request validation.
- **Prompt workshop:** compose seven ingredients into a prompt, copy it or save it as text.
- **Reference desk:** prework, glossary, official documentation and optional advanced study.

All parts remain available for exploration. There are no timers or forced waiting. Keyboard controls, focus mode, responsive layouts and reduced-motion settings support different learning preferences.

## Foundation: lessons 01–60

Each of the original twelve parts contains five lessons.

| Part | Lessons | Focus |
| --- | --- | --- |
| 01 | 01–05 | How backends work |
| 02 | 06–10 | Data foundations |
| 03 | 11–15 | Identity and security |
| 04 | 16–20 | Catalog and cart |
| 05 | 21–25 | Checkout and payments |
| 06 | 26–30 | Orders and fulfillment |
| 07 | 31–35 | Async work and integrations |
| 08 | 36–40 | Speed and scale |
| 09 | 41–45 | Testing and debugging |
| 10 | 46–50 | Delivery and operations |
| 11 | 51–55 | Working precisely with AI |
| 12 | 56–60 | Assemble the complete backend |

## Practical track: lessons 61–108

Each practical part adds three lessons and one mission. Services are taught through their responsibilities and connections; using every platform together is optional.

| Part | Lessons | Focus | Mission theme |
| --- | --- | --- | --- |
| 13 | 61–63 | Local development and project setup | Diagnose a project that will not start. |
| 14 | 64–66 | Environment variables and secrets | Sort configuration and repair environment mistakes. |
| 15 | 67–69 | Connect a Next.js backend | Assemble a request with checks in the correct layer. |
| 16 | 70–72 | Supabase database and access | Enforce database permissions and customer ownership. |
| 17 | 73–75 | Supabase authentication lifecycle | Diagnose sessions, callbacks and insecure roles. |
| 18 | 76–78 | Supabase storage and server tools | Separate public images from private documents. |
| 19 | 79–81 | Vercel deployment lifecycle | Repair simulated build/runtime configuration. |
| 20 | 82–84 | Render services and workers | Investigate ports, health checks and storage behavior. |
| 21 | 85–87 | Connect the architecture | Place responsibilities and explain each connection. |
| 22 | 88–90 | Book a shipment safely | Recover a shipment booking without duplicates. |
| 23 | 91–93 | Tracking, returns and COD | Keep delivery, remittance, return and stock states distinct. |
| 24 | 94–96 | Connect a payment provider | Verify payments, recover uncertainty and reconcile settlement. |
| 25 | 97–99 | Email, SMS and notifications | Prevent repeated events from sending repeated messages. |
| 26 | 100–102 | Networking and security in practice | Distinguish CORS, credentials and authorization failures. |
| 27 | 103–105 | Operate and recover the store | Diagnose backlog and reconcile recovery with external reality. |
| 28 | 106–108 | The connected Fieldstore capstone | Trace ten stages from signup through return and refund. |

The capstone uses one consistent synthetic store: a blue shirt at **25000 INR minor units (₹250)**. Its explicit stock, quarantine, payment and fulfillment assumptions are documented in [CAPSTONE.md](docs/CAPSTONE.md).

## Learn or teach one topic

1. **Understand:** explain the concept and why it matters using the store example.
2. **Explore:** activate each diagram node. Identify the actor, input, rule, saved result and failure boundary.
3. **Solve:** predict before revealing the explanation. Discuss why a plausible alternative fails.
4. **Apply:** inspect the implementation example and choose the appropriate AI prompt mode. Supply actual project context and expected evidence.
5. **Check:** demonstrate or explain the three self-checks, write a takeaway, and complete the lesson.
6. **Practice:** open the part's mission or a related lab. Change one condition and predict its effect.

For a class, let learners predict independently, compare reasoning and demonstrate the result together. A checked box records a learner's self-assessment; it is not an independently graded certification or proof of a live integration.

The Prompt workshop combines project context, feature/actor, inputs/outputs, invariants, constraints, failure/concurrency cases and acceptance evidence. Its ingredient count indicates filled sections, not correctness. Workshop prompts remain editable text for your chosen tool. The separate tutor makes provider requests only when you submit a question; it cannot execute implementation instructions.

## Simulations and optional integrations

Course activities run locally using synthetic fixtures. Payment, notification, inventory and shipping examples demonstrate state changes and recovery decisions without contacting commerce providers. The original arcade and labs remain available alongside the practical missions. The optional AI tutor is a real text-generation integration with its own configuration.

Provider walkthroughs reference current official documentation, including Supabase, Vercel, Render, Shiprocket, Razorpay, Resend and Twilio where relevant. Code blocks are teaching examples; they are **displayed, not executed as real integrations**. Optional implementation work in a separate project requires checking its actual versions, credentials, provider capabilities and business rules.

Deployment lessons explain builds, environments, callbacks, observability and rollback through examples. The course creates no cloud resources, opens no public tunnel, connects no live payment/shipping account and performs no deployment.

A passing simulation establishes the modeled rules only. It does not establish that a real provider integration, production concurrency control or deployed store works. Keep secrets and real customer data out of prompts, notes, fixtures and logs.

## Progress, rewards and portability

The original `backend-fieldguide-v1` browser storage key remains compatible. Older completion marks are respected; existing learners do not need to redo previously completed foundation lessons after upgrading.

- **20 XP** per completed lesson, **100 XP** per completed arcade game, **50 XP** per completed practical mission.
- Rewards derive from unique completion records. Replaying a game or mission does not duplicate its award.
- Marking a lesson incomplete removes its 20 XP while retaining its passed quiz and self-check records for review.
- Lesson progress, mission completion and arcade medals are separate. Optional advanced tracks do not change course totals.

Saved state includes completed lessons, passed quiz IDs, practical self-checks, mission completions, arcade achievements, lesson notes, last visited lesson, the Prompt workshop draft and the reduced-animation setting.

Use **Export** in the sidebar to download `backend-fieldguide-progress.json`. **Import replaces saved course state** and resets the current view's temporary state; it does not merge two learners' histories. Exports contain notes and prompt drafts, so inspect them before sharing.

Storage belongs to the current browser profile and origin, including hostname and port. There is no account or cloud sync. Clearing site data removes the local copy; keep an export as a backup. If browser storage cannot be read or written, a notice prompts you to export before closing the session.

**Unfinished game/mission rounds and lab state are temporary.** They reset on leaving the activity or refreshing; earned completions remain saved. Active diagram nodes, revealed answers and current quiz selections are also temporary. Lesson prompt edits last while the lesson is open; expand the prompt into the workshop to save the draft.

## Keyboard and motion

Use **Tab**, **Enter** and **Space** to navigate controls. Ordering activities provide buttons rather than requiring dragging. **Ctrl/Cmd + K** focuses lesson search; **Escape** dismisses navigation/search. Use the footer's **Reduce animations** control or your system's reduced-motion preference. Focus mode gives the learning content more screen space.

## Source map

| Path | Responsibility |
| --- | --- |
| `app/page.js` | Hash navigation, progress import/export, diagrams, labs, workshop and resources. |
| `app/layout.js`, `app/*.css` | Root document, metadata, shared design, responsive layouts and motion. |
| `components/Journey.js` | Learning tracks, part views, next steps, progress and milestones. |
| `components/LessonExperience.js` | Four-stage lessons, seven prompt modes, quizzes, notes and completion checks. |
| `components/PracticeStudio.js` | Practical mission navigation, scenarios, ordering and placement activities. |
| `components/PracticeExperiments.js` | Interactive local experiment panels used by missions. |
| `components/GameArcade.js`, `lib/game-data.js` | Three arcade games, scenarios and explanations. |
| `components/CourseTutor.js`, `app/api/tutor/route.js` | Tutor interface and server-only API entry point. |
| `lib/retrieval.mjs` | Local lesson index and deterministic course retrieval. |
| `lib/tutor-server.mjs`, `lib/ai-providers.mjs` | Tutor input/access checks, grounded prompts, provider adapters and bounded failover. |
| `lib/course.mjs` | Course metadata, ID sets, navigation helpers and reward calculations. |
| `lib/progress.mjs` | Saved-state defaults, validation and compatibility. |
| `lib/simulations.mjs` | Pure state transitions for local practice experiments. |
| `lib/lessons.json`, `lib/interactions.json` | Lesson content, prompts, checks, quiz answers and diagram explanations. |
| `lib/reference.json`, `lib/activities.json` | Part metadata, glossary, sources, advanced tracks and practical missions. |
| `public/labs.js` | Original browser-only inventory, payment and request simulations. |
| `tests/course.test.mjs`, `tests/original-lesson-identity.json` | Content/progress checks and the retained foundation identity fixture. |
| `tests/simulations.test.mjs` | Simulation invariants, retries and state-transition checks. |

The application uses React and the Next.js App Router. Views are selected through URL hashes within the client app. Curriculum counts and navigation come from the data instead of a fixed sixty-lesson assumption.

## Checks and troubleshooting

```sh
npm test
npm run build
```

Automated checks cover content integrity, retained lesson identity, progress compatibility and simulation invariants. Browser verification remains necessary for interaction, layout, keyboard access and persistence flows. Live provider access also depends on your keys, account and current model availability. See the [verification record](docs/VERIFICATION.md) for checks actually performed and their limits.

If port 3000 is occupied, stop the other local server or run `npm run dev -- --port 3001`. Use the printed URL and export progress before changing hostname or port. For an outdated production preview, stop it, build again, restart and reload; use the development server while editing.

For a bug report, include the lesson or mission, expected behavior, observed behavior and reproduction steps. Use synthetic/redacted evidence and primary sources for factual corrections. Preserve existing IDs and update related examples, quizzes, prompts and simulations together when a rule changes. Report actual checks rather than assuming a successful build verifies every interaction.
