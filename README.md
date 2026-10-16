
LecturAI

Paste a YouTube lecture link. Get notes, a quiz and flashcards you can keep.

LecturAI is a MERN web app that reads the transcript of a YouTube lecture (even a 2-hour one), and uses the Groq API to produce a structured summary, key points, definitions, 10 multiple-choice questions and flashcards. Everything is saved to your account, and you can chat with the lecture: answers come only from that video's transcript.

<!-- Add a screenshot: ![LecturAI result page](docs/screenshot.png) -->
Features
Transcript extraction from any YouTube video with captions (auto-captions included)
Whole-video coverage: long transcripts are split into chunks, each chunk is analysed, then the notes are merged (map-reduce), so the summary and quiz cover the beginning, middle and end
Study pack: structured summary, key points, definitions, 10 MCQs, flashcards
Interactive quiz: click an option and it instantly turns green or red, with an explanation and a final score
3D flip flashcards
Ask the video: chat that answers only from the lecture transcript (retrieval with BM25), and says so when the video doesn't cover a question
Personal library with search, so you can find "normalization" notes from a lecture you did last month
Hindi / English notes toggle
Export to PDF (print stylesheet)
Auth: email + password (JWT) and Google login
Tech stack
Layer	Tools
Frontend	React 18, Vite, Tailwind CSS, React Router, Axios, react-markdown, @react-oauth/google
Backend	Node.js, Express, Mongoose, JWT, bcryptjs, google-auth-library, express-rate-limit
Database	MongoDB (local or Atlas)
AI	Groq API (Llama models), youtube-transcript

No Python needed. Groq has a free tier, so no paid API is required.

How it works
Paste link
   |
React frontend --POST /api/summarize--> Express API
                                           |
        1. extract video ID, fetch title + thumbnail (YouTube oEmbed)
        2. fetch transcript (youtube-transcript) and clean it
        3. split into ~5000-char chunks
        4. MAP: Groq extracts topics, points, definitions from each chunk
        5. REDUCE: merge chunk notes in order
        6. Groq generates summary, key points, definitions, 10 MCQs, flashcards
        7. validate JSON, retry on bad output
        8. save to MongoDB, return to the frontend

"Ask the video" does not use the whole transcript each time. It scores transcript chunks against your question with BM25, sends the top few to Groq, and instructs the model to answer only from them.

Project structure
lecturai/
  backend/
    server.js
    config/db.js
    models/         User.js, Video.js
    middleware/     auth.js
    routes/         auth.js, videos.js
    services/       transcript.js, ai.js, rag.js
  frontend/
    src/
      pages/        Landing, Result, Library, Login
      components/   Navbar, McqQuiz, Flashcards, AskChat, ProgressTerminal
      lib/          api.js, auth.jsx
Getting started
Prerequisites
Node.js 18 or newer
MongoDB running locally, or a free MongoDB Atlas cluster
A free Groq API key from https://console.groq.com/keys
(Optional) a Google OAuth client ID for Google login
1. Backend
bash
cd backend
cp .env.example .env     # then edit .env
npm install
npm run dev              # http://localhost:5000
2. Frontend
bash
cd frontend
cp .env.example .env
npm install
npm run dev              # http://localhost:5173

Open http://localhost:5173, create an account, and paste a lecture link.

Environment variables

backend/.env

Variable	Description
PORT	API port (default 5000)
MONGO_URI	MongoDB connection string
JWT_SECRET	Long random string used to sign login tokens
GROQ_API_KEY	Your Groq key (starts with gsk_)
GROQ_MODEL	e.g. llama-3.3-70b-versatile or llama-3.1-8b-instant
GOOGLE_CLIENT_ID	Google OAuth web client ID (optional)
CLIENT_URL	Frontend URL for CORS (default http://localhost:5173)

frontend/.env

Variable	Description
VITE_GOOGLE_CLIENT_ID	Same Google client ID (optional)
Setting up Google login (optional)
Go to Google Cloud Console > APIs & Services > Credentials.
Create an OAuth client ID of type Web application.
Add http://localhost:5173 under Authorized JavaScript origins.
Put the client ID in both .env files.

Email login works without this.

API reference

All routes except the auth ones need the header Authorization: Bearer <token>.

Method	Route	Description
POST	/api/auth/signup	Create account
POST	/api/auth/login	Log in
POST	/api/auth/google	Log in with a Google ID token
GET	/api/auth/me	Current user
POST	/api/summarize	Body: { url, language }. Runs the pipeline, or returns the saved result
GET	/api/videos?q=	List or search your library
GET	/api/videos/:id	One saved lecture
DELETE	/api/videos/:id	Delete a lecture
POST	/api/videos/:id/ask	Body: { question, history }. Answers from that transcript only

Every query is scoped to the logged-in user. You can only read your own lectures.

Data models

User: name, email (unique), password (hashed), googleId, avatar

Video: userId, videoId, youtubeUrl, title, thumbnail, language, transcript, summary, keyPoints[], definitions[], mcqs[] (question, 4 options, answer index, explanation), flashcards[], timestamps

Troubleshooting
Problem	Fix
Notes look generic or contain random words, or you see "offline demo mode"	The Groq key isn't loaded. Check GROQ_API_KEY in backend/.env and restart the backend
"This video has no captions to read"	The video has captions turned off. Try another video
Every video fails to fetch a transcript	YouTube probably changed something. Run npm update youtube-transcript in backend
Errors mentioning 429 or rate limit	Groq's free tier is limited. The server waits and retries. Long lectures take a few minutes
Google button does nothing	Check the client ID and that http://localhost:5173 is an authorized origin
CORS error in the browser	Make sure CLIENT_URL in the backend matches the frontend URL exactly
Deployment
Database: MongoDB Atlas (allow the Render IP, or 0.0.0.0/0 for testing)
Backend: Render web service. Root directory backend, build npm install, start npm start. Add all backend env vars
Frontend: Vercel. Root directory frontend, add VITE_GOOGLE_CLIENT_ID, and change the baseURL in src/lib/api.js to https://<your-render-app>.onrender.com/api
Set CLIENT_URL on the backend to your Vercel URL, and add that URL to the Google OAuth authorized origins
Known limitations
Videos without captions can't be processed yet
Retrieval in "Ask the video" is keyword-based, so it is weaker when you paraphrase heavily
Quality depends on caption accuracy. Auto-captions sometimes mangle technical terms
Free-tier Groq limits slow down very long videos
Future scope
Whisper speech-to-text fallback for videos without captions
Embedding-based retrieval for better chat answers
More languages beyond Hindi and English
Real PDF export with a styled template
Chrome extension to summarize from the YouTube page
College LMS integration, and a study streak / leaderboard# Lecture.Ai
