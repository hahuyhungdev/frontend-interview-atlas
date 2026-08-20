import { useCallback, useEffect, useState } from 'react';
import { KnowledgeLibrary } from '../../../shared/types';

interface KnowledgeResponse {
  success: boolean;
  knowledge?: KnowledgeLibrary | null;
  error?: string;
  warning?: string;
}

export function useKnowledgeLibrary() {
  const [library, setLibrary] = useState<KnowledgeLibrary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/knowledge');
      const result: KnowledgeResponse = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Unable to load the knowledge library.');
      }
      setLibrary(result.knowledge || null);
      setError(result.warning || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the knowledge library.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  return {
    error,
    isLoading,
    library,
  };
}
