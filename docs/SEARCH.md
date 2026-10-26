# Search and discover

The search bar connects the whole fieldguide: lessons, course parts, practice missions, games, labs, glossary entries, prompt templates, official reference cards and app pages. It also offers an explicit **Ask AI** action for explanations and follow-up questions.

## Find something

Click the top search bar or press **Ctrl+K** (**Command+K** on macOS). Type a concept, a problem or a lesson number. Results update locally as you type, with matching words highlighted and filters for each content type. Typing does not send your question to an AI provider.

Try these searches:

- `lesson 64` or `Explain lesson 64`
- `Why does a payment success redirect not prove payment?`
- `Practice environment variables and secrets`
- `RLS` or `authentication vs authorization`
- `AI prompt for duplicate webhooks`
- `payment game`

Matching uses weighted words and phrases, common technical aliases, some English/Hinglish equivalents and limited typo correction. It is a local content index, not an internet search engine. A vague query can need more specific wording.

| Result type | What opens |
| --- | --- |
| Lessons | The matching lesson in your current course copy. |
| Course parts | The part overview and its lessons. |
| Practice missions | The practical mission. |
| Games | The matching backend game. |
| Labs | The inventory, payments or API lab. |
| Glossary | The reference desk focused on the term, or its source lesson for a lesson-derived definition. |
| Prompts | The lesson's Apply stage and matching prompt mode. |
| References | The relevant course reference destination, plus a direct official documentation link. |
| Pages | App areas such as settings, the course workspace or tutor. |

Personal lesson results show **Your course copy**. Completed lessons show their completion status. Prompt results include a text preview and **Copy prompt**. **Show more connections** expands longer result lists.

## Keyboard controls

| Shortcut | Action |
| --- | --- |
| Ctrl+K / Command+K | Open search and select the top search field. |
| Enter in either search field | Explicitly ask AI about the current question. |
| Down arrow in a search field | Focus the first local result. |
| Up / Down on results | Move through results. Up from the first returns to the search field. |
| Home / End on results | Focus the first or last currently displayed result. |
| Enter on a result | Open that result. |
| Escape | Close search and return to learning. |

The original learning page stays mounted behind search. Closing search restores its scroll position and reopens the tutor if it was open before search.

## Ask for an explanation

Choose **Ask AI**, or press Enter in a search field, when you want an answer. Local results remain usable if AI is unavailable. A connection indicator and **Check again** action show whether a configured provider is ready.

Answers have one of two labels:

- **Explanation using course material:** the server retrieved relevant course evidence. Numbered citations open their course destinations. Expand **Explore the evidence** to read the excerpts and see any available official reference link.
- **General AI explanation · outside the course:** no suitable course evidence was selected. The answer comes from model knowledge and is not supported by course excerpts.

Neither mode browses the live web. Reference cards are bundled link descriptions, not freshly fetched documentation. Search cannot verify today's news, prices, provider status or account details. It cannot inspect repositories, run commands or edit lessons. Use **Edit course** or the tutor's reviewed course proposals for course changes.

Use **Keep the thought going** to ask a follow-up. At most the last three completed question/answer pairs accompany the next request. **Stop answer** cancels a pending request; failed or stopped questions can be retried. Changing the main query or language starts a fresh search conversation. **Ask tutor about this** opens the tutor with the question as an editable draft; it does not submit another model request automatically.

Answers follow **Settings → Language**: English or light Hinglish, with technical terms in English and occasional familiar Hindi words written in English letters. AI answers can still contain mistakes; use the displayed evidence to check important claims.

## Your course copy and privacy

Local results include your added and edited lessons. When you explicitly ask AI, the browser sends your question, language, recent search conversation, the current lesson-title registry and up to six bounded personal lesson excerpts to the app server. It prioritizes a relevant personal lesson when building that context. The server selects up to four distinct, relevant source excerpts for the model, together with your question, recent conversation and language instructions. It does not forward the full lesson registry to the model.

An edited lesson replaces the original lesson's teaching facts. If its current excerpt is absent, the server omits that lesson from answer evidence instead of silently using the old version. Added and edited excerpts are labeled **unverified personal content**. Prompt templates are instruction ideas, not proof that an implementation works.

Stored learner notes, exercise drafts, arbitrary local files and provider credentials are not automatically attached to search. Anything you type into a question or personal lesson can still be part of a request, so keep secrets and customer data out of that content. Provider fallback can send the same answer request to another configured provider under the existing rotation rules.

Search conversation and access-code entry stay in component memory for the open search session. They are not saved to browser storage or progress exports. Closing search clears them. The app does not create a search-history database; configured providers apply their own data handling policies. Course edits themselves continue to use the existing local course storage and export system.

## Voice

Search reuses the tutor's voice controls. **Record question** records locally; after stopping and reviewing it, **Transcribe** explicitly sends the recording for transcription. The resulting text fills the search field for editing. Asking AI is still a separate action.

Completed answers offer **Read aloud** using the configured natural voice, plus the existing **Browser voice** option. Playback starts only when requested. The same audio limits, microphone permissions, provider setup and English/Hinglish pronunciation limitations apply. See [voice input and read aloud](AI_TUTOR.md#voice-input-and-read-aloud) for details.

## Server setup and access

Search needs no additional environment variables or provider keys. It reuses the tutor's existing server-only configuration, provider order, automatic switching on limits and `TUTOR_ACCESS_CODE`. Local content search works without any AI configuration. See [AI tutor setup](AI_TUTOR.md#local-setup) and [`.env.example`](../.env.example).

`GET /api/search` reports availability, configured provider names and whether an access code is needed. `POST /api/search` accepts an explicit question and returns the answer, source excerpts, answer kind and provider/model names. Keys never appear in these responses.

The endpoint checks same-origin requests and uses the existing tutor access policy: public or remotely forwarded access requires a configured access code of at least 16 characters. A configured code also protects local requests. Requests are limited to a 2,000-character question, six recent messages of up to 4,000 characters each and a 64 KiB JSON body.

AI search permits 10 requests per minute and two concurrent requests in each server process, with the existing provider router's 45-second total attempt budget. These are process-local guards, not a shared limit across multiple server instances. Cancelling or finishing a request releases its concurrency slot. Model output is rendered as escaped text with supported formatting; generated HTML is not executed.

## Implementation

- [`lib/search.mjs`](../lib/search.mjs): shared local index and ranking.
- [`components/SearchExperience.js`](../components/SearchExperience.js): results, filters, answers, sources, voice and keyboard interaction.
- [`app/search.css`](../app/search.css): search presentation and motion.
- [`lib/search-server.mjs`](../lib/search-server.mjs): validation, access controls, course retrieval and provider requests.
- [`app/api/search/route.js`](../app/api/search/route.js): the search API route.
- [`tests/search.test.mjs`](../tests/search.test.mjs) and [`tests/search-server.test.mjs`](../tests/search-server.test.mjs): matching, grounding, privacy, access and cancellation checks.
