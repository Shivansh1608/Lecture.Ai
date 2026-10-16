import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../lib/api';

export default function Library() {
  const [videos, setVideos] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      api.get('/videos', { params: { q } }).then((r) => setVideos(r.data.videos)).catch((e) => setError(errMsg(e)));
    }, 250); // debounce search
    return () => clearTimeout(t);
  }, [q]);

  async function remove(id) {
    if (!confirm('Delete these notes? This cannot be undone.')) return;
    await api.delete(`/videos/${id}`);
    setVideos((v) => v.filter((x) => x._id !== id));
  }

  return (
    <section className="pt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="font-display text-4xl">My library</h1>
        <input className="field sm:!w-80" placeholder="Search notes, e.g. normalization" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search your library" />
      </div>
      {error && <p className="mt-4 text-bad" role="alert">{error}</p>}
      {videos && !videos.length && (
        <p className="mt-10 text-dust">{q ? `Nothing matches "${q}".` : 'No lectures yet. '}{!q && <Link to="/" className="text-amber underline">Paste your first link</Link>}</p>
      )}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {videos?.map((v) => (
          <li key={v._id} className="border border-rune bg-vault">
            <Link to={`/lecture/${v._id}`} className="block hover:text-amber">
              <img src={v.thumbnail} alt="" className="aspect-video w-full object-cover" loading="lazy" />
              <div className="p-3">
                <h2 className="line-clamp-2 font-display text-xl leading-tight">{v.title}</h2>
                <p className="mt-1 text-xs text-dust">{new Date(v.createdAt).toLocaleDateString()}</p>
              </div>
            </Link>
            <div className="border-t border-rune p-2 text-right">
              <button className="text-xs text-dust hover:text-bad" onClick={() => remove(v._id)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
