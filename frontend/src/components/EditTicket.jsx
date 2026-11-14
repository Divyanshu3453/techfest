import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

// Lets the reporter correct their own complaint until the department head starts work.
// Saving sends the ticket back through triage, so a corrected category moves it to the right department.
export default function EditTicket({ ticket, onDone, onCancel }) {
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [main, setMain] = useState(ticket.main_category || '');
  const [sub, setSub] = useState(ticket.sub_category || '');
  const [label, setLabel] = useState(ticket.location_label || '');
  const [description, setDescription] = useState(ticket.description);
  const [isPublic, setIsPublic] = useState(ticket.is_public);
  const [removeImage, setRemoveImage] = useState(false);
  const [image, setImage] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/complaints/categories').then(setCategories).catch((e) => setError(e.message));
    api('/locations').then(setLocations).catch(() => {});
  }, []);

  const subs = useMemo(() => categories.find((c) => c.label === main)?.subs || [], [categories, main]);
  const words = description.trim().split(/\s+/).filter(Boolean).length;

  async function save(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const form = new FormData();
      form.append('main_category', main);
      form.append('sub_category', sub);
      form.append('description', description);
      form.append('location_label', label);
      form.append('is_public', isPublic ? 'true' : 'false');
      form.append('remove_image', removeImage ? 'true' : 'false');
      if (image) form.append('image', image);
      await api(`/complaints/${ticket.id}`, { method: 'PATCH', form });
      window.dispatchEvent(new Event('refresh'));
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="edit-form" onSubmit={save}>
      <h3>Edit your complaint</h3>
      <p className="muted">You can change it until the department head arranges a worker. After saving, it is checked again and may go to a different department.</p>

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

      <label>Place
        <input list="edit-places" value={label} onChange={(e) => setLabel(e.target.value)} required />
        <datalist id="edit-places">{locations.map((l) => <option key={l.id} value={l.label} />)}</datalist>
      </label>

      <label>What is wrong?
        <textarea rows={6} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </label>
      <p className={words > 300 ? 'error' : 'muted'}>{words} / 300 words</p>

      <label className="check">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        Show on the public campus feed
      </label>

      {ticket.image_url && !removeImage && !image && (
        <>
          <img className="preview small" src={ticket.image_url} alt="Current" />
          <label className="check"><input type="checkbox" checked={removeImage} onChange={(e) => setRemoveImage(e.target.checked)} /> Remove this photo</label>
        </>
      )}
      <label>{ticket.image_url ? 'Replace photo (optional)' : 'Add a photo (optional)'}
        <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files[0] || null)} />
      </label>

      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn" disabled={busy || words < 5 || words > 300 || !main || !sub}>{busy ? 'Saving…' : 'Save changes'}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
