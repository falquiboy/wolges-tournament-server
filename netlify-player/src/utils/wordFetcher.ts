
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const INITIAL_BATCH_SIZE = 5000;
const MAX_BATCH_SIZE = 10000;
const MIN_BATCH_SIZE = 1000;
const MAX_RETRIES = 8; // Increased from 5
const MAX_PARALLEL_REQUESTS = 3;
const CHECKPOINT_KEY = 'word_fetch_checkpoint';
const DELAY_BETWEEN_RETRIES = 2000; // 2 seconds

interface CheckpointData {
  lastWord: string;
  totalFetched: number;
  timestamp: number;
}

const saveCheckpoint = (lastWord: string, totalFetched: number) => {
  const checkpoint: CheckpointData = {
    lastWord,
    totalFetched,
    timestamp: Date.now()
  };
  localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));
};

const loadCheckpoint = (): CheckpointData | null => {
  const saved = localStorage.getItem(CHECKPOINT_KEY);
  if (!saved) return null;
  
  try {
    const checkpoint = JSON.parse(saved) as CheckpointData;
    // Only use checkpoints less than 1 hour old
    if (Date.now() - checkpoint.timestamp > 3600000) {
      localStorage.removeItem(CHECKPOINT_KEY);
      return null;
    }
    return checkpoint;
  } catch {
    localStorage.removeItem(CHECKPOINT_KEY);
    return null;
  }
};

const clearCheckpoint = () => {
  localStorage.removeItem(CHECKPOINT_KEY);
};

export const fetchAllWords = async (
  expectedCount: number,
  onProgress: (progress: number) => void
) => {
  let allWords: string[] = [];
  let lastWord: string | null = null;
  let retryCount = 0;
  let lastProgress = 0;
  let batchSize = INITIAL_BATCH_SIZE;
  let consecutiveSuccesses = 0;
  let consecutiveFailures = 0;
  
  const inFlightRequests: Promise<string[]>[] = [];
  const processedWords = new Set<string>();

  // Try to resume from checkpoint
  const checkpoint = loadCheckpoint();
  if (checkpoint) {
    console.log(`Resuming from checkpoint: ${checkpoint.totalFetched} words fetched, last word: ${checkpoint.lastWord}`);
    lastWord = checkpoint.lastWord;
    allWords = Array.from(processedWords);
    onProgress(Math.floor((checkpoint.totalFetched / expectedCount) * 100));
  }

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const adjustBatchSize = (success: boolean, latency: number) => {
    if (success) {
      consecutiveSuccesses++;
      consecutiveFailures = 0;
      if (latency < 1000 && consecutiveSuccesses > 2) {
        batchSize = Math.min(batchSize * 1.5, MAX_BATCH_SIZE);
        console.log(`Increased batch size to ${batchSize}`);
      }
    } else {
      consecutiveFailures++;
      consecutiveSuccesses = 0;
      batchSize = Math.max(batchSize / 2, MIN_BATCH_SIZE);
      console.log(`Reduced batch size to ${batchSize}`);
    }
  };

  const fetchBatch = async (startWord: string): Promise<string[]> => {
    const startTime = Date.now();
    try {
      const { data, error } = await supabase
        .from('words')
        .select('word')
        .gt('word', startWord)
        .order('word')
        .limit(Math.floor(batchSize));

      if (error) throw error;

      const latency = Date.now() - startTime;
      adjustBatchSize(true, latency);
      console.log(`Batch fetched in ${latency}ms: ${data?.length || 0} words`);

      return data?.map(w => w.word) || [];
    } catch (error) {
      console.error('Batch fetch error:', error);
      adjustBatchSize(false, 0);
      throw error;
    }
  };

  const fetchBatchWithRetry = async (startWord: string): Promise<string[]> => {
    let currentRetry = 0;
    
    while (currentRetry < MAX_RETRIES) {
      try {
        return await fetchBatch(startWord);
      } catch (error) {
        currentRetry++;
        consecutiveFailures++;
        
        if (currentRetry >= MAX_RETRIES) {
          console.error(`Failed after ${MAX_RETRIES} retries for batch starting at ${startWord}`);
          throw error;
        }
        
        const backoffDelay = Math.min(DELAY_BETWEEN_RETRIES * Math.pow(2, currentRetry), 10000);
        console.log(`Retry ${currentRetry}/${MAX_RETRIES} after ${backoffDelay}ms`);
        await delay(backoffDelay);
        
        // Reduce batch size after each retry
        batchSize = Math.max(batchSize / 2, MIN_BATCH_SIZE);
      }
    }
    
    throw new Error('Max retries exceeded');
  };

  const verifyWordCount = () => {
    if (allWords.length < expectedCount) {
      const missing = expectedCount - allWords.length;
      console.error(`Missing ${missing} words. Expected: ${expectedCount}, Got: ${allWords.length}`);
      return false;
    }
    return true;
  };

  try {
    let hasMore = true;
    let failedAttempts = 0;
    
    while (hasMore && failedAttempts < 3) {
      try {
        // Mantener MAX_PARALLEL_REQUESTS solicitudes en vuelo
        while (inFlightRequests.length < MAX_PARALLEL_REQUESTS && hasMore) {
          const request = fetchBatchWithRetry(lastWord || '')
            .then(words => {
              if (words.length > 0) {
                lastWord = words[words.length - 1];
                return words;
              }
              hasMore = false;
              return [];
            });
            
          inFlightRequests.push(request);
        }

        // Esperar a que termine al menos una solicitud
        const completedBatch = await Promise.race(inFlightRequests);
        const index = inFlightRequests.findIndex(p => p.then(() => completedBatch));
        if (index !== -1) {
          inFlightRequests.splice(index, 1);
        }

        // Procesar las palabras recibidas
        for (const word of completedBatch) {
          if (!processedWords.has(word)) {
            processedWords.add(word);
            allWords.push(word);
          }
        }

        // Save checkpoint every 10000 words
        if (allWords.length % 10000 === 0) {
          saveCheckpoint(lastWord || '', allWords.length);
        }

        // Actualizar progreso
        const currentProgress = Math.floor((allWords.length / expectedCount) * 100);
        if (currentProgress > lastProgress) {
          lastProgress = currentProgress;
          onProgress(currentProgress);
          console.log(`Loading progress: ${currentProgress}% (${allWords.length}/${expectedCount} words)`);
        }

        // Verificar si hemos terminado
        if (allWords.length >= expectedCount || completedBatch.length === 0) {
          hasMore = false;
        }

        failedAttempts = 0; // Reset failed attempts on success

      } catch (error) {
        console.error('Batch processing error:', error);
        failedAttempts++;
        await delay(DELAY_BETWEEN_RETRIES * failedAttempts);
      }
    }

    // Esperar las solicitudes pendientes
    if (inFlightRequests.length > 0) {
      const remainingBatches = await Promise.all(inFlightRequests);
      for (const batch of remainingBatches) {
        for (const word of batch) {
          if (!processedWords.has(word)) {
            processedWords.add(word);
            allWords.push(word);
          }
        }
      }
    }

    // Verificación final
    const isComplete = verifyWordCount();
    if (!isComplete) {
      throw new Error(`Incomplete dictionary: got ${allWords.length} words, expected ${expectedCount}`);
    }

    // Clear checkpoint on successful completion
    clearCheckpoint();
    console.log('Word fetching completed successfully');
    return allWords;
    
  } catch (error) {
    console.error('Error fetching words:', error);
    toast.error(error instanceof Error ? error.message : 'Failed to fetch dictionary');
    throw error;
  }
};
