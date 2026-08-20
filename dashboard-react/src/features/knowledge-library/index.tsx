import { KnowledgeLibraryView } from './components/KnowledgeLibraryView';
import { useKnowledgeLibrary } from './hooks/useKnowledgeLibrary';

export function KnowledgeLibrarySection() {
  const state = useKnowledgeLibrary();
  return <KnowledgeLibraryView {...state} />;
}
