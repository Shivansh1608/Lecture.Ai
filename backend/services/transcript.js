import { YoutubeTranscript } from 'youtube-transcript';

export function extractVideoId(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export async function getVideoMeta(videoId) {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (r.ok) {
      const d = await r.json();
      return { title: d.title, thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` };
    }
  } catch {}
  return { title: 'Untitled lecture', thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` };
}

const decode = (s) =>
  s.replace(/&amp;#39;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

export async function getTranscript(videoId, language = 'English') {
  let items;
  const langCode = language?.toLowerCase().startsWith('hi') ? 'hi' : 'en';
  try {
    items = await YoutubeTranscript.fetchTranscript(videoId, { lang: langCode });
  } catch {
    // If specific language captions fail, attempt default captions
    try {
      items = await YoutubeTranscript.fetchTranscript(videoId);
    } catch {
      const err = new Error('This video has no captions to read.');
      err.status = 422;
      throw err;
    }
  }
  if (!items?.length) {
    const err = new Error('This video has no captions to read.');
    err.status = 422;
    throw err;
  }
  return items.map((i) => decode(i.text)).filter(Boolean).join(' ');
}

// Split on word boundaries into ~size-char chunks (used for map-reduce + RAG)
export function chunkText(text, size = 6000) {
  const words = text.split(' ');
  const chunks = [];
  let cur = [];
  let len = 0;
  for (const w of words) {
    cur.push(w);
    len += w.length + 1;
    if (len >= size) { chunks.push(cur.join(' ')); cur = []; len = 0; }
  }
  if (cur.length) chunks.push(cur.join(' '));
  return chunks;
}
