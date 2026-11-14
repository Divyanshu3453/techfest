import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import FeedCard from '../FeedCard.jsx';
import '../search.css';

const SearchIcon = (p) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
  </svg>
);

const EXAMPLES = ['block b bathroom', 'wifi not working', 'mess food quality', 'fan not working', 'water leakage'];

// Search every registered complaint by keywords or meaning. Results are normal feed cards,
// so the student can upvote or comment right here. `onActiveChange` lets the page hide its feed.
export default function SearchBar({ onActiveChange }) {
  const [q, setQ] = useState('');
  const [includeResolved, setIncludeResolved] = useState(false);
  const [results, setResults] = useState(null); // null = nothing searched yet
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  const active = q.trim().length >= 2;
  useEffect(() => { onActiveChange?.(active); }, [active, onActiveChange]);

  const run = useCallback(async (text, all) => {
    const mine = ++seq.current;
    setLoading(true);
    setError('');
    try {
      const data = await api(`/feed/search?q=${encodeURIComponent(text)}&scope=${all ? 'all' : 'open'}`);
      if (mine === seq.current) setResults(data);
    } catch (e) {
      if (mine === seq.current) setError(e.message);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  // debounce typing
  useEffect(() => {
    if (!active) { seq.current++; setResults(null); setLoading(false); setError(''); return undefined; }
    const t = setTimeout(() => run(q.trim(), includeResolved), 400);
    return () => clearTimeout(t);
  }, [q, includeResolved, active, run]);

  // keep results live when someone upvotes / comments / the status changes (socket "refresh")
  useEffect(() => {
    if (!active) return undefined;
    const again = () => run(q.trim(), includeResolved);
    window.addEventListener('refresh', again);
    return () => window.removeEventListener('refresh', again);
  }, [active, q, includeResolved, run]);

  async function upvote(id) {
    setError('');
    try {
      await api(`/feed/${id}/upvote`, { method: 'POST' });
      run(q.trim(), includeResolved);
    } catch (e) { setError(e.message); }
  }

  return (
    <>
      <div className="li-card issue-search">
        <div className="search-row">
          <SearchIcon />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Search reported issues, e.g. "block b bathroom"'
            aria-label="Search reported issues"
            maxLength={200}
          />
          {q && <button type="button" className="search-clear" onClick={() => setQ('')} aria-label="Clear search">×</button>}
        </div>

        {!active && (
          <div className="search-chips">
            {EXAMPLES.map((ex) => <button type="button" key={ex} onClick={() => setQ(ex)}>{ex}</button>)}
          </div>
        )}
        {active && (
          <div className="search-tools">
            <span>{loading ? 'Searching…' : results ? `${results.length} registered issue${results.length === 1 ? '' : 's'} found` : ''}</span>
            <label>
              <input type="checkbox" checked={includeResolved} onChange={(e) => setIncludeResolved(e.target.checked)} />
              Include resolved issues
            </label>
          </div>
        )}
      </div>

      {active && (
        <div className="search-results">
          {error && <p className="error">{error}</p>}
          {results && results.length === 0 && !loading && (
            <div className="empty">
              Nothing registered matches “{q.trim()}”. If it is your problem, <Link to="/report">report it</Link>.
            </div>
          )}
          {results && results.map((item) => <FeedCard key={item.id} item={item} onUpvote={upvote} />)}
        </div>
      )}
    </>
  );
}
