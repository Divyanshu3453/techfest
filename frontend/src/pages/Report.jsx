import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import FeedCard from '../FeedCard.jsx';
import '../search.css';

const MAX_WORDS = 300;

export default function Report() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [main, setMain] = useState('');
  const [sub, setSub] = useState('');
  const [locations, setLocations] = useState([]);
  const [coords, setCoords] = useState({ lat: '', lng: '' });
  const [label, setLabel] = useState('');
  const [locNote, setLocNote] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [isPublic, setIsPublic] = useState(true); // visibility of the issue on the campus feed

  // duplicate check
  const [matches, setMatches] = useState([]);
  const [checking, setChecking] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [voteError, setVoteError] = useState('');
  const seq = useRef(0);
  const panelRef = useRef(null);

  useEffect(() => {
    api('/locations').then(setLocations).catch(() => {});
    api('/complaints/categories').then(setCategories).catch((e) => setError(e.message));
  }, []);

  const subs = useMemo(() => categories.find((c) => c.label === main)?.subs || [], [categories, main]);
  const picked = subs.find((s) => s.label === sub);

  const words = description.trim().split(/\s+/).filter(Boolean).length;
  const tooLong = words > MAX_WORDS;

  // Re-check for similar open issues shortly after the student stops typing
  useEffect(() => {
    if (words < 5 || !sub) { setMatches([]); setChecking(false); return undefined; }
    const mine = ++seq.current;
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const body = { description, sub_category: sub, location_label: label };
        if (coords.lat !== '') { body.lat = coords.lat; body.lng = coords.lng; }
        const data = await api('/complaints/similar', { method: 'POST', body });
        if (mine === seq.current) setMatches(data.matches);
      } catch { /* the server re-checks on submit anyway */ }
      finally { if (mine === seq.current) setChecking(false); }
    }, 800);
    return () => { clearTimeout(t); seq.current++; };
  }, [description, sub, label, coords, words]);

  // a different set of matches means the student must decide again
  const signature = matches.map((m) => m.id).join(',');
  useEffect(() => { setConfirmNew(false); }, [signature]);

  function detect() {
    setLocNote('Finding you…');
    if (!navigator.geolocation) return setLocNote('This browser cannot share location. Pick a place from the list.');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        try {
          const { match } = await api(`/locations/resolve?lat=${lat}&lng=${lng}`);
          if (match) {
            setLabel(match.label);
            setLocNote(`Matched to a spot about ${match.distance_m} m away. Edit it if it’s wrong.`);
          } else setLocNote('No known campus spot nearby. Type the place below.');
        } catch (e) { setLocNote(e.message); }
      },
      () => setLocNote('Location permission was denied. Pick a place from the list.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function pickImage(e) {
    const f = e.target.files[0];
    setImage(f || null);
    setPreview(f ? URL.createObjectURL(f) : '');
  }

  async function upvote(id) {
    setVoteError('');
    try {
      await api(`/feed/${id}/upvote`, { method: 'POST' });
      setMatches((list) => list.map((m) => (m.id === id ? { ...m, joined: true, affected_count: m.affected_count + 1 } : m)));
      window.dispatchEvent(new Event('refresh'));
    } catch (e) { setVoteError(e.message); }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const form = new FormData();
      form.append('main_category', main);
      form.append('sub_category', sub);
      form.append('description', description);
      form.append('location_label', label);
      form.append('confirmed_new', confirmNew ? 'true' : 'false');
      form.append('is_public', isPublic ? 'true' : 'false');
      if (coords.lat !== '') { form.append('lat', coords.lat); form.append('lng', coords.lng); }
      if (image) form.append('image', image);
      const c = await api('/complaints', { method: 'POST', form });
      navigate(`/ticket/${c.id}`);
    } catch (err) {
      if (err.status === 409 && err.data?.duplicates) {
        // server found similar issues the student hadn't seen yet
        setMatches(err.data.duplicates);
        setConfirmNew(false);
        setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      }
      setError(err.message);
      setBusy(false);
    }
  }

  const alreadyIn = matches.find((m) => m.joined);
  const needsDecision = matches.length > 0 && !confirmNew;
  const canSubmit = !busy && !tooLong && words >= 5 && main && sub && !needsDecision;

  return (
    <form className="card form-card" onSubmit={submit}>
      <h1>Report an issue</h1>

      <fieldset>
        <legend>What is it about?</legend>
        <div className="field-row">
          <label>Category
            <select value={main} onChange={(e) => { setMain(e.target.value); setSub(''); }} required>
              <option value="">Select a category…</option>
              {categories.map((c) => <option key={c.label} value={c.label}>{c.label}</option>)}
            </select>
          </label>
          <label>Sub-category
            <select value={sub} onChange={(e) => setSub(e.target.value)} disabled={!main} required>
              <option value="">{main ? 'Select a sub-category…' : 'Choose a category first'}</option>
              {subs.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
            </select>
          </label>
        </div>
        {picked?.department && <p className="route-hint">This will be sent to: {picked.department}</p>}
      </fieldset>

      <fieldset>
        <legend>Where is it?</legend>
        <button type="button" className="btn ghost" onClick={detect}>Use my current location</button>
        {locNote && <p className="muted">{locNote}</p>}
        <label>Place
          <input list="places" value={label} onChange={(e) => setLabel(e.target.value)}
                 placeholder="e.g. Block B Bathroom, Aryabhatta Hostel" required />
          <datalist id="places">{locations.map((l) => <option key={l.id} value={l.label} />)}</datalist>
        </label>
      </fieldset>

      <label>What is wrong?
        <textarea rows={7} value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the problem, since when it has been happening, and who it affects." required />
      </label>
      <p className={tooLong ? 'error' : 'muted'}>{words} / {MAX_WORDS} words</p>

      {checking && words >= 5 && sub && <p className="checking">Checking whether this has already been reported…</p>}

      {matches.length > 0 && (
        <section className="similar-panel" ref={panelRef} aria-live="polite">
          <h3>This looks already reported</h3>
          <p className="muted">
            {matches.length === 1 ? 'One open issue matches' : `${matches.length} open issues match`} what you described.
            If it is the same problem, upvote it or add a comment instead of filing a duplicate.
          </p>

          <div className="similar-list">
            {matches.map((m) => (
              <div key={m.id}>
                <span className="match-badge">{m.score}% match</span>
                {m.same_spot && <span className="match-badge spot">Same location</span>}
                {m.joined && <span className="match-badge mine">You’re part of this</span>}
                <FeedCard item={m} onUpvote={upvote} />
              </div>
            ))}
          </div>

          {voteError && <p className="error">{voteError}</p>}

          {alreadyIn && (
            <div className="similar-done">
              You are now counted on <strong>{alreadyIn.ticket_no}</strong>, so there is no need to file it again.{' '}
              <Link to="/">Back to home</Link>
            </div>
          )}

          <div className="similar-actions">
            {confirmNew ? (
              <>
                <span className="notice">Okay, yours will be registered as a new complaint.</span>
                <button type="button" className="btn ghost small" onClick={() => setConfirmNew(false)}>Undo</button>
              </>
            ) : (
              <button type="button" className="btn ghost small" onClick={() => setConfirmNew(true)}>
                None of these is my issue — register a new complaint
              </button>
            )}
          </div>
        </section>
      )}

      <fieldset className="visibility-field">
        <legend>Who can see this issue?</legend>
        <label className={`visibility-opt${isPublic ? ' on' : ''}`}>
          <input type="radio" name="visibility" checked={isPublic} onChange={() => setIsPublic(true)} />
          <span><strong>Public</strong><small>Shown on the campus feed so other students can upvote and comment.</small></span>
        </label>
        <label className={`visibility-opt${!isPublic ? ' on' : ''}`}>
          <input type="radio" name="visibility" checked={!isPublic} onChange={() => setIsPublic(false)} />
          <span><strong>Private</strong><small>Hidden from the feed and search. Only you and the department staff handling it can see it.</small></span>
        </label>
      </fieldset>

      <label>Photo (optional)
        <input type="file" accept="image/*" onChange={pickImage} />
      </label>
      {preview && <img className="preview" src={preview} alt="Selected issue" />}

      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={!canSubmit}>{busy ? 'Submitting…' : 'Submit report'}</button>
      {needsDecision && <p className="muted">Upvote a matching issue above, or confirm that yours is different, to continue.</p>}
    </form>
  );
}
