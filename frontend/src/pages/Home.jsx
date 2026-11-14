import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import FeedCard from '../FeedCard.jsx';
import SearchBar from '../components/SearchBar.jsx';
import { CameraIcon } from '../Icons.jsx';

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

export default function Home() {
  const { user } = useAuth();
  const [sort, setSort] = useState('latest');
  const [feed, setFeed] = useState([]);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    try { setFeed(await api(`/feed?sort=${sort}`)); }
    catch (e) { setError(e.message); }
  }, [sort]);

  // Reload on mount, on sort change, and whenever the server pushes a socket event
  useEffect(() => {
    load();
    window.addEventListener('refresh', load);
    return () => window.removeEventListener('refresh', load);
  }, [load]);

  async function upvote(id) {
    setError('');
    try { await api(`/feed/${id}/upvote`, { method: 'POST' }); load(); }
    catch (e) { setError(e.message); }
  }

  return (
    <>
      <SearchBar onActiveChange={setSearching} />

      {!searching && (
        <>
          <div className="li-card composer">
            <div className="composer-row">
              <span className="li-avatar">{initials(user.name)}</span>
              <Link to="/report" className="composer-input">Report a campus issue…</Link>
            </div>
            <div className="composer-actions">
              <Link to="/report"><CameraIcon width={20} height={20} /> Photo &amp; location</Link>
            </div>
          </div>

          <div className="li-sort">
            <hr />
            <label>Sort by:
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="latest">Latest</option>
                <option value="trending">Trending</option>
              </select>
            </label>
          </div>

          {error && <p className="error">{error}</p>}
          {feed.length === 0 && <p className="empty li-card">No open issues on campus right now. Report one if something needs fixing.</p>}
          <div className="feed">
            {feed.map((item) => <FeedCard key={item.id} item={item} onUpvote={upvote} />)}
          </div>
        </>
      )}
    </>
  );
}
