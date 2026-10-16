# Master prompt for Antigravity: LecturAI

Paste everything below the line into Antigravity (Planning mode, Agent Manager). If you also drop the `lecturai/` starter folder into the workspace, add this first line: "A working starter exists in /backend and /frontend. Read it, then improve and extend it per this spec instead of rewriting from scratch."

---

You are a senior full-stack engineer and a sharp UI designer. Build **LecturAI**, a MERN web app that turns a YouTube lecture link into study material. Work in phases. After each phase, run the app, test it, and show me what works before starting the next one. Do not ask me questions unless you are blocked. Make sensible assumptions and list them at the end.

## 1. What the product does
A student pastes a YouTube lecture link (for example a 2-hour DBMS lecture). The app:
1. Extracts the transcript (auto-captions included).
2. Cleans it and, for long videos, chunks it (map-reduce) so it fits model limits.
3. Sends it to the Groq API (free tier, model `llama-3.1-8b-instant`) and gets back JSON with: a ~150 word summary, 8 key points, 4-6 important definitions, 5 MCQs (4 options each, correct index, one-line explanation), 5 flashcards (term and definition).
4. Saves the result to MongoDB under the user's account.
5. Lets the user ask questions about that one lecture (RAG). Answers must come only from that video's transcript; if the transcript doesn't cover it, say "This video doesn't cover that."

## 2. Tech stack (fixed)
- Frontend: React 18 + Vite, Tailwind CSS v3, React Router, Axios, react-markdown, @react-oauth/google.
- Backend: Node 18+, Express, ES modules, Mongoose, jsonwebtoken, bcryptjs, google-auth-library, express-rate-limit, cors, dotenv.
- Database: MongoDB (local or Atlas).
- AI: Groq API via plain `fetch` (no SDK needed), `youtube-transcript` npm package for captions.
- No Python. No paid APIs. Never put API keys in frontend code. Keep secrets in `.env` and provide `.env.example`.

## 3. Folder structure
```
lecturai/
  backend/  server.js, config/, models/, middleware/, routes/, services/
  frontend/ src/{pages,components,lib}
  README.md
```

## 4. Data models
- User: name, email (unique), password (bcrypt hash, `select:false`, optional for Google users), googleId, avatar, timestamps.
- Video: userId (indexed), videoId, youtubeUrl, title, thumbnail, language, transcript (`select:false`), summary, keyPoints[], definitions[{term, meaning}], mcqs[{question, options[4], answer(0-3), explanation}], flashcards[{term, definition}], timestamps. Unique index on (userId, videoId, language). Text index on title, summary, keyPoints.

## 5. API
All routes except auth need `Authorization: Bearer <jwt>`.
- POST /api/auth/signup, /login, /google (verify Google ID token server-side), GET /api/auth/me
- POST /api/summarize `{url, language: "English"|"Hindi"}`: return the cached result if this user already did this video and language, otherwise run the pipeline.
- GET /api/videos?q= (search the user's library), GET /api/videos/:id, DELETE /api/videos/:id
- POST /api/videos/:id/ask `{question, history}`: retrieve the top relevant transcript chunks with BM25 (no vector DB), then ask Groq to answer using only those chunks.
Every query is scoped to `req.userId`. A user must never read another user's lecture.

## 6. AI pipeline requirements
- Extract the 11-char video ID from watch, youtu.be, embed and shorts URLs. Fetch title and thumbnail via YouTube oEmbed.
- If captions are missing, return a clear 422 message ("This video has no captions to read"). Mention in the README that a Whisper fallback is future work.
- Chunk long transcripts (~6000 chars), condense each chunk to notes, then generate the final JSON from the condensed notes.
- Use `response_format: {type: "json_object"}`. Parse defensively, retry once on bad JSON, and normalise the result so the UI never crashes (exactly 4 options per MCQ, clamp `answer` to 0-3).
- Handle Groq 429 rate limits with exponential back-off.
- If language is Hindi, write all output in Hindi (Devanagari).

## 7. Frontend pages
1. **Landing**: the hero is the input. A big terminal-style prompt (`$`) where the user pastes the link, a language select (English/Hindi), and a "Make my notes" button. While waiting, show a live progress terminal (fetching captions, condensing, generating, saving). Redirect to login first if logged out.
2. **Result** (`/lecture/:id`): left side has the embedded YouTube player (sticky on desktop) plus Export PDF and "Notes in Hindi/English" buttons. Right side has tabs: Summary, Key points, Quiz, Flashcards, Ask the video.
   - Quiz: click an option and it instantly turns green or red, reveals the right answer and explanation, locks the question, and shows a final score with a retry.
   - Flashcards: a 3D flip card with previous/next and a counter.
   - Ask the video: chat UI with suggested starter questions, history, and markdown answers.
   - Export PDF: use `window.print()` with a print stylesheet that shows summary, definitions and key points on a white background.
3. **My Library**: grid of past lectures with thumbnail, title, language, date. Debounced search, delete with confirmation, empty state.
4. **Login / Signup**: email + password and Google login.

## 8. Design direction (important, do not make it look like a generic SaaS template)
The look is a dark, mystical scriptorium crossed with a hacker terminal. It should feel like a tool a student would enjoy opening at 1 a.m.
- Palette: ink `#0F0B1F` (page), vault `#181233` (panels), rune `#2A2150` (borders), parchment `#EAE3D2` (text), dust `#9A93B5` (muted), amber `#FFB347` (primary action, phosphor glow), sigil `#8B7CFF` (secondary accent), good `#7BE0A4`, bad `#FF7A7A`.
- Type: Instrument Serif for headings, JetBrains Mono for UI and body. Sentence case everywhere. No all-caps eyebrow labels, no gradient text.
- Make one memorable moment: the terminal-style input and its progress stream on the landing page. Keep everything else quiet. Flat panels with 1px borders, no drop-shadow cards, no emoji icons.
- Motion only in response to the user (card flip, answer reveal, blinking caret while loading). Respect `prefers-reduced-motion`.
- Responsive down to 375px, visible keyboard focus, contrast AA, line length under 80 characters for reading text.
- Optional stretch after everything works: a subtle 3D element on the landing page (for example a slowly rotating wireframe of a book or neural lattice using three.js or react-three-fiber) that does not hurt performance or readability.

## 9. Quality bar
- Friendly, specific error messages on every failure (bad link, no captions, Groq down, expired session). Never show a blank screen.
- Loading and empty states everywhere.
- No secrets in git. Add `.gitignore`. Validate and sanitise all inputs. Rate-limit the API.
- Escape user input before using it in a regex search.
- Add a README with: setup steps, how to get a Groq key and Google OAuth client ID, env variables, how to run both apps, and how to deploy (backend on Render, frontend on Vercel, MongoDB Atlas, CORS and `VITE_` env notes).

## 10. Phases
1. Backend skeleton + MongoDB + auth (signup, login, Google, `/me`). Test with curl.
2. Transcript service + Groq pipeline + `/api/summarize`. Test with a real short lecture and a long one.
3. Frontend: routing, auth context, Landing, Login.
4. Result page with all five tabs, then Library.
5. RAG chat endpoint and UI.
6. Polish: design pass, print stylesheet, error states, responsive check.
7. Write a basic test script for the transcript parser and BM25 retriever, then the README.

At the end, give me: the run commands, what you tested, what you could not test and why, and your assumptions.
