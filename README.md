# LecturAI

Turn two hours of YouTube lecture into ten minutes of revision.

Paste a YouTube lecture link, extract auto-captions/transcripts, condense with Groq's high-speed Llama 3.1 model, and receive an instant study pack: an executive summary, 8 key takeaways, critical definitions, a 5-question multiple choice quiz with instant explanations, 5 interactive 3D flashcards, and an in-browser RAG chatbot that answers questions strictly from the lecture transcript.

---

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS v3, React Router v6, Axios, react-markdown, `@react-oauth/google`.
- **Backend**: Node.js 18+, Express (ES Modules), Mongoose, JSON Web Tokens (`jsonwebtoken`), bcryptjs, Google Auth Library (`google-auth-library`), express-rate-limit, CORS, dotenv.
- **Database**: MongoDB (Local or MongoDB Atlas).
- **AI & NLP**: Groq API (`llama-3.1-8b-instant`), `youtube-transcript`, custom in-process BM25 lexical retriever for local RAG without vector database overhead.

---

## Folder Structure

```
Lecture_Ai/
├── backend/
│   ├── config/         # MongoDB connection (db.js)
│   ├── middleware/     # JWT authentication middleware (auth.js)
│   ├── models/         # Mongoose models: User.js, Video.js
│   ├── routes/         # Express endpoints: auth.js, videos.js
│   ├── services/       # transcript.js, ai.js (Groq), rag.js (BM25)
│   ├── server.js       # Main server entrypoint
│   ├── test.js         # Automated test suite (parser & BM25)
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/ # AskChat, Flashcards, McqQuiz, Navbar, ProgressTerminal
│   │   ├── lib/        # Axios API client, Auth Context
│   │   ├── pages/      # Landing, Result, Library, Login
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css   # Mystical terminal aesthetic & print styles
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js
│   ├── .env.example
│   └── package.json
└── README.md
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default / Example |
|---|---|---|
| `PORT` | Backend HTTP listening port | `5000` |
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/lecturai` |
| `JWT_SECRET` | Secret key for signing authentication JWTs | A long random string |
| `GROQ_API_KEY` | Free API key from Groq Console | `gsk_...` |
| `GROQ_MODEL` | Groq Llama model identifier | `llama-3.1-8b-instant` |
| `GOOGLE_CLIENT_ID` | Optional Google OAuth 2.0 Web Client ID | `...apps.googleusercontent.com` |
| `CLIENT_URL` | Allowed origin for CORS in development/production | `http://localhost:5173` |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Optional Google OAuth 2.0 Web Client ID (matches backend) |

---

## Quickstart

### Prerequisites
- Node.js 18 or higher (`node -v`)
- MongoDB running locally or a free MongoDB Atlas connection string.
- A free Groq API key from [https://console.groq.com/keys](https://console.groq.com/keys).

### 1. Setup Backend

```bash
cd backend

# Copy .env.example and configure your variables
cp .env.example .env

# Install dependencies (already installed if using starter)
npm install

# Run automated tests to verify transcript parser and BM25 search
npm test

# Start backend server
npm run dev
# Server will listen on http://localhost:5000
```

### 2. Setup Frontend

```bash
# In a new terminal window
cd frontend

# Copy .env.example
cp .env.example .env

# Install dependencies
npm install

# Start Vite dev server
npm run dev
# App will run at http://localhost:5173
```

Open `http://localhost:5173` in your browser.

---

## Automated Test Suite

A standalone test suite validates URL extraction across standard, short, live, embed, and shorts formats, transcript chunking boundaries, and BM25 relevance ranking.

Run tests:
```bash
cd backend
npm test
```

Expected output:
```
--- 1. Testing extractVideoId ---
  ✓ extracts from standard watch url
  ✓ extracts from youtu.be short url
  ✓ extracts from embed url
  ✓ extracts from shorts url
  ✓ extracts from live url
  ✓ extracts with query params and timestamps
  ✓ accepts raw 11-char video ID
  ✓ returns null on non-youtube link
  ✓ returns null on empty input

--- 2. Testing chunkText ---
  ✓ returns 1 chunk if shorter than size
  ✓ splits long text into multiple chunks
  ✓ chunks do not break words

--- 3. Testing topPassages (BM25 Retriever) ---
  ✓ retrieves relevant passage for BCNF query
  ✓ retrieves relevant passage for ACID query
  ✓ returns empty list for completely irrelevant query
  ✓ handles null or empty transcript safely
  ✓ handles empty query safely

Results: 17 passed, 0 failed.
```

---

## Deploying to Production

### 1. Database (MongoDB Atlas)
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a database user and allow your server IP (or `0.0.0.0/0`).
3. Copy your connection URI (`mongodb+srv://<user>:<password>@cluster0.mongodb.net/lecturai?retryWrites=true&w=majority`).

### 2. Backend (Render / Railway)
1. Create a new **Web Service** pointing to your repository.
2. Root directory: `backend`.
3. Build command: `npm install`.
4. Start command: `npm start`.
5. Set environment variables:
   - `NODE_ENV`: `production`
   - `MONGO_URI`: Your MongoDB Atlas URI.
   - `JWT_SECRET`: A secure 64-character random string.
   - `GROQ_API_KEY`: Your Groq API key.
   - `GROQ_MODEL`: `llama-3.1-8b-instant`.
   - `CLIENT_URL`: Your frontend URL (e.g., `https://lecturai.vercel.app`).
   - `GOOGLE_CLIENT_ID`: (Optional) Your Google OAuth Client ID.

### 3. Frontend (Vercel)
1. Import repository on [Vercel](https://vercel.com).
2. Root directory: `frontend`.
3. Framework preset: **Vite**.
4. Set environment variable:
   - `VITE_GOOGLE_CLIENT_ID`: (Optional) Your Google OAuth Client ID.
5. In `frontend/src/lib/api.js`, update `baseURL` to point to your deployed backend URL:
   ```javascript
   const api = axios.create({
     baseURL: import.meta.env.VITE_API_URL || '/api',
     timeout: 300000
   });
   ```

---

## Known Limits & Future Work
- **Captions Required**: The app uses YouTube's subtitle tracks. Videos with disabled or unavailable captions will return a clean 422 error. A Whisper transcription fallback is planned for future releases.
- **BM25 vs Vector Embeddings**: Retrieval for the "Ask the video" chat utilizes local in-memory BM25 keyword ranking, which requires zero vector database infrastructure and executes with near-instant speed.
- **Groq Free Tier Limits**: Rate limits on the free tier (RPM/TPM) are handled automatically with exponential back-off retries.
