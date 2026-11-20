/**
 * Future door state on this device (`next:future` in localStorage) and its
 * sync with /api/future/tracker for signed-in students. Every storage access
 * is wrapped: private windows and blocked storage just mean nothing persists.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { useSession } from '../../ui/index.js';
import { cleanItem, mergeItems, newId, DEFAULT_CHECKLIST } from '../../../shared/next/future/tracker.js';
import { classOfFor, gradeOf } from '../../../shared/next/future/roadmap.js';

const KEY = 'next:future';
const SAVED_KEY = 'e-saved'; // the bookmark list the old opportunities page used, kept so old saves carry over

export function readStore() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function writeStore(patch) {
  const next = { ...readStore(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked */
  }
  return next;
}

/** Tracker items on this device, dropping anything that no longer validates. */
export const localItems = () => {
  const items = readStore().items;
  return Array.isArray(items) ? items.map((i) => cleanItem(i).item).filter(Boolean) : [];
};

export function readSaved() {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(v) ? v.filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}
function writeSaved(ids) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
  } catch {
    /* storage blocked */
  }
}

/** The student's grade, asked once and stored as a class year so it rolls over each August. */
export function useGrade() {
  const [classOf, setClassOf] = useState(() => readStore().classOf ?? null);
  const grade = classOf ? gradeOf(classOf) : null;
  const setGrade = useCallback((g) => {
    const c = g ? classOfFor(g) : null;
    writeStore({ classOf: c });
    setClassOf(c);
  }, []);
  return { grade, setGrade };
}

/**
 * Tracker items with local-first saves. Signed in, the first load merges
 * this device with the server (newer copy wins) and pushes anything the
 * server is missing; after that every change is written to both.
 * ponytail: an item deleted while signed out comes back from the server on
 * the next sign-in; add tombstones if that ever bites.
 */
export function useTracker() {
  const { user, loading } = useSession();
  const [items, setItems] = useState(localItems);
  const [syncError, setSyncError] = useState('');
  const uid = user?.id;

  useEffect(() => {
    if (loading || !uid) return undefined;
    let off = false;
    api
      .get('/future/tracker')
      .then(async ({ items: remote }) => {
        const merged = mergeItems(localItems(), remote);
        const seen = new Map(remote.map((r) => [r.id, r.updatedAt ?? 0]));
        const push = merged.filter((m) => !seen.has(m.id) || (m.updatedAt ?? 0) > seen.get(m.id));
        await Promise.all(push.map((m) => api.put(`/future/tracker/${m.id}`, m).catch(() => {})));
        if (off) return;
        writeStore({ items: merged });
        setItems(merged);
        setSyncError('');
      })
      .catch((e) => !off && setSyncError(e.message));
    return () => {
      off = true;
    };
  }, [uid, loading]);

  const upsert = useCallback(
    (item) => {
      const it = { ...item, updatedAt: Date.now() };
      setItems((prev) => {
        const next = prev.some((p) => p.id === it.id) ? prev.map((p) => (p.id === it.id ? it : p)) : [...prev, it];
        writeStore({ items: next });
        return next;
      });
      if (uid) api.put(`/future/tracker/${it.id}`, it).then(() => setSyncError(''), (e) => setSyncError(e.message));
      return it;
    },
    [uid]
  );

  const remove = useCallback(
    (id) => {
      setItems((prev) => {
        const next = prev.filter((p) => p.id !== id);
        writeStore({ items: next });
        return next;
      });
      if (uid) api.del(`/future/tracker/${id}`).catch((e) => setSyncError(e.message));
    },
    [uid]
  );

  return { items, upsert, remove, signedIn: Boolean(uid), syncError };
}

const steps = (list) => list.map((text) => ({ text, done: false }));

/** Tracker items built from the three sources the pages offer. */
export const fromProgram = (p) => ({
  id: newId(), title: p.name, status: 'interested', deadline: '', notes: '', url: p.url, ref: `prog:${p.id}`, outcome: '',
  checklist: steps(p.type === 'competition' || p.type === 'hackathon' ? ['Register'] : DEFAULT_CHECKLIST),
});
export const fromOpp = (o) => ({
  id: newId(), title: o.title, status: 'interested', deadline: o.deadline ? String(o.deadline).slice(0, 10) : '', notes: '', url: o.url || '',
  ref: `opp:${o.id}`, outcome: '', checklist: steps(o.type === 'competition' ? ['Register'] : DEFAULT_CHECKLIST),
});
export const fromCollege = (c, deadline) => ({
  id: newId(), title: `Apply: ${c.name}`, status: 'preparing', deadline, notes: '', url: '', ref: '', outcome: '',
  checklist: steps(['Personal statement', 'Supplements', 'Teacher recommendations', 'Counselor letter', 'Test scores', 'Transcript', 'Financial aid forms']),
});

/**
 * Saved live opportunities. Signed in, a save is the club's "I'm doing this"
 * mark (/me/interests), so it shows on every device and to the club; signed
 * out, it is a bookmark on this device.
 */
export function useSaved() {
  const { user, loading } = useSession();
  const [local, setLocal] = useState(readSaved);
  const [mine, setMine] = useState([]);
  const uid = user?.id;

  useEffect(() => {
    if (loading || !uid) return;
    api.get('/opp-interest').then((r) => setMine(r.mine ?? [])).catch(() => {});
  }, [uid, loading]);

  const saved = useMemo(() => new Set([...local, ...(uid ? mine : [])]), [local, mine, uid]);

  const toggle = useCallback(
    async (id) => {
      const on = !saved.has(id);
      if (uid) {
        setMine((m) => (on ? [...m, id] : m.filter((x) => x !== id)));
        try {
          await (on ? api.post(`/me/interests/${id}`) : api.del(`/me/interests/${id}`));
        } catch (e) {
          setMine((m) => (on ? m.filter((x) => x !== id) : [...m, id]));
          throw e;
        }
      }
      // Keep the device list in step either way, so unsaving also clears an old bookmark.
      setLocal((l) => {
        const next = on ? [...new Set([...l, id])] : l.filter((x) => x !== id);
        writeSaved(next);
        return next;
      });
      return on;
    },
    [saved, uid]
  );

  return { saved, toggle };
}
