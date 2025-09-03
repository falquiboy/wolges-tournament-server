
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const INITIAL_BATCH_SIZE = 5000;
const MAX_BATCH_SIZE = 10000;
const MIN_BATCH_SIZE = 1000;
const MAX_PARALLEL_REQUESTS = 3;
const MAX_RETRIES = 3;

export class WordLoader {
  private lastWord = '';
  private totalWords = 0;
  private expectedCount: number;
  private batchSize: number;
  private consecutiveSuccesses = 0;
  private consecutiveFailures = 0;
  
  constructor(expectedCount: number) {
    this.expectedCount = expectedCount;
    this.batchSize = INITIAL_BATCH_SIZE;
  }

  private adjustBatchSize(success: boolean, latency: number) {
    if (success) {
      this.consecutiveSuccesses++;
      this.consecutiveFailures = 0;
      
      // Si el tiempo de respuesta es bueno y tenemos éxitos consecutivos, aumentamos el tamaño
      if (latency < 1000 && this.consecutiveSuccesses > 2) {
        this.batchSize = Math.min(this.batchSize * 1.5, MAX_BATCH_SIZE);
        console.log(`Increasing batch size to ${this.batchSize}`);
      }
    } else {
      this.consecutiveFailures++;
      this.consecutiveSuccesses = 0;
      
      // Reducimos el tamaño del batch si hay fallos
      this.batchSize = Math.max(this.batchSize / 2, MIN_BATCH_SIZE);
      console.log(`Reducing batch size to ${this.batchSize}`);
    }
  }

  private async fetchBatchWithRetry(lastWord: string, retryCount = 0): Promise<string[]> {
    const startTime = Date.now();
    
    try {
      const { data: words, error } = await supabase
        .from('words')
        .select('word')
        .gt('word', lastWord)
        .order('word')
        .limit(Math.floor(this.batchSize));

      if (error) throw error;
      
      const latency = Date.now() - startTime;
      this.adjustBatchSize(true, latency);
      
      if (!words || words.length === 0) return [];
      return words.map(w => w.word);
      
    } catch (error) {
      console.error(`Batch fetch error (attempt ${retryCount + 1}):`, error);
      
      if (retryCount >= MAX_RETRIES) {
        throw new Error(`Failed to fetch words after ${MAX_RETRIES} attempts`);
      }

      this.adjustBatchSize(false, 0);
      
      // Backoff exponencial
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return this.fetchBatchWithRetry(lastWord, retryCount + 1);
    }
  }

  async *loadWords(): AsyncGenerator<string[], void> {
    let hasMore = true;
    const inFlightRequests: Promise<string[]>[] = [];
    let currentLastWord = this.lastWord;

    while (hasMore) {
      try {
        // Mantenemos hasta MAX_PARALLEL_REQUESTS solicitudes en vuelo
        while (inFlightRequests.length < MAX_PARALLEL_REQUESTS && hasMore) {
          const batchPromise = this.fetchBatchWithRetry(currentLastWord);
          inFlightRequests.push(batchPromise);
          
          // Preparamos la siguiente solicitud
          const nextBatchPromise = this.fetchBatchWithRetry(currentLastWord)
            .then(words => {
              if (words.length > 0) {
                currentLastWord = words[words.length - 1];
                return words;
              }
              hasMore = false;
              return [];
            });
          
          // Si aún no hemos alcanzado el máximo, agregamos la siguiente solicitud
          if (inFlightRequests.length < MAX_PARALLEL_REQUESTS) {
            inFlightRequests.push(nextBatchPromise);
          }
        }

        // Esperamos a que termine al menos una solicitud
        const completedBatch = await Promise.race(inFlightRequests);
        
        // Removemos la solicitud completada del array
        const index = inFlightRequests.findIndex(p => p.then(() => completedBatch));
        if (index !== -1) {
          inFlightRequests.splice(index, 1);
        }

        if (completedBatch.length > 0) {
          this.totalWords += completedBatch.length;
          this.lastWord = completedBatch[completedBatch.length - 1];
          yield completedBatch;
        } else {
          hasMore = false;
        }

        // Verificamos si hemos alcanzado el total esperado
        if (this.totalWords >= this.expectedCount) {
          console.log('Reached expected word count');
          hasMore = false;
        }

      } catch (error) {
        console.error('Word loading error:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to load dictionary');
        throw error;
      }
    }

    // Esperamos que terminen todas las solicitudes pendientes
    if (inFlightRequests.length > 0) {
      const remainingBatches = await Promise.all(inFlightRequests);
      for (const batch of remainingBatches) {
        if (batch.length > 0) {
          this.totalWords += batch.length;
          yield batch;
        }
      }
    }
  }

  getProgress(): number {
    return Math.min((this.totalWords / this.expectedCount) * 100, 100);
  }
}
