import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DocSummary, DocDetail } from '../../../shared/types';

type Status = 'idle' | 'loading' | 'error' | 'success';

export function useDocsIndex() {
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');

    fetch('/api/docs', { signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        if (!payload.success) throw new Error(payload.error);
        setDocs(payload.docs);
        setStatus('success');
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setStatus('error');
      });

    return () => controller.abort();
  }, []);

  const groups = useMemo(() => {
    const byGroup = new Map<string, DocSummary[]>();
    docs.forEach((doc) => {
      const key = doc.group || '';
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(doc);
    });
    return Array.from(byGroup.entries());
  }, [docs]);

  return { docs, groups, status };
}

export function useDoc(slug: string | undefined) {
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  // Documents are static on disk, so caching avoids a refetch when navigating back.
  const cache = useRef(new Map<string, DocDetail>());

  const load = useCallback((target: string, signal: AbortSignal) => {
    const cached = cache.current.get(target);
    if (cached) {
      setDoc(cached);
      setStatus('success');
      return Promise.resolve();
    }

    setStatus('loading');
    return fetch(`/api/docs/${target}`, { signal })
      .then((response) => {
        if (!response.ok) throw new Error('Document not found.');
        return response.json();
      })
      .then((payload) => {
        if (!payload.success) throw new Error(payload.error);
        cache.current.set(target, payload.doc);
        setDoc(payload.doc);
        setStatus('success');
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setDoc(null);
        setStatus('error');
      });
  }, []);

  useEffect(() => {
    if (!slug) {
      setDoc(null);
      setStatus('idle');
      return;
    }
    const controller = new AbortController();
    load(slug, controller.signal);
    return () => controller.abort();
  }, [slug, load]);

  return { doc, status };
}
