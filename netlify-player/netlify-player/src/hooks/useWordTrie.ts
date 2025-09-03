/**
 * Hook principal que expone el sistema de Trie con construcción background
 * Usa Web Worker para construcción no-bloqueante y fallback inmediato
 */

import { useBackgroundTrie } from './useBackgroundTrie';

// Re-export del hook background como interfaz principal
export const useWordTrie = (enableUltraFastMode: boolean = false) => {
  const { hybridService, isTrieReady, trieProgress, status, error } = useBackgroundTrie(enableUltraFastMode);
  
  // Mapear los estados para compatibilidad con la interfaz legacy
  const isLoading = status === 'loading' || status === 'building';
  const isTrieBuilding = status === 'building';
  const loadingProgress = trieProgress ? trieProgress.progress : (status === 'ready' ? 100 : 0);
  
  // Mapear stage para compatibilidad
  const stage = status === 'loading' ? 'initializing' as const : 
                status === 'building' ? 'building' as const :
                status === 'ready' ? 'complete' as const :
                'error' as const;

  // Estimar word count basado en progreso
  const wordCount = trieProgress ? trieProgress.total : (status === 'ready' ? 639293 : 0);
  
  return {
    isLoading,
    isTrieBuilding,
    error: error ? new Error(error) : null,
    wordCount,
    trie: hybridService, // ✅ Servicio híbrido siempre disponible
    loadingProgress,
    stage
  };
};

// Legacy export for backwards compatibility
export type LoadingStage = 'initializing' | 'download' | 'processing' | 'building' | 'complete' | 'error';