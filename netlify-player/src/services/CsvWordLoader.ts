
import { supabase } from '@/integrations/supabase/client';
import { sqliteDB, WordEntry } from '@/services/SQLiteWordDatabase';
import { toast } from 'sonner';

const CSV_BUCKET_NAME = 'words';
const CSV_FILE_PATH = 'words.csv.gz'; // Usar archivo comprimido para descarga más rápida
// Reduced chunk size from 10000 to 1000 for better performance on mobile devices
const CHUNK_SIZE = 1000;
// Short delay between chunks to allow device to cool down
const COOLING_PERIOD_MS = 10;

export class CsvWordLoader {
  private totalWords = 0;
  private processedWords = 0;
  private expectedCount: number;
  private abortController: AbortController | null = null;
  
  constructor(expectedCount: number) {
    this.expectedCount = expectedCount;
  }

  getProgress(): number {
    return Math.min((this.processedWords / this.expectedCount) * 100, 100);
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async loadCsvFile(): Promise<boolean> {
    try {
      console.log('Checking for CSV dictionary in Supabase storage...');
      
      // Check if the file exists
      const { data: fileData, error: fileError } = await supabase
        .storage
        .from(CSV_BUCKET_NAME)
        .download(CSV_FILE_PATH);
      
      if (fileError || !fileData) {
        console.log('CSV file not found or error accessing it:', fileError);
        return false;
      }
      
      console.log('CSV file found, starting processing...');
      this.abortController = new AbortController();
      
      // Process the CSV file
      return await this.processCsvFile(fileData);
    } catch (error) {
      console.error('Error loading CSV file:', error);
      return false;
    }
  }
  
  private async processCsvFile(file: Blob): Promise<boolean> {
    try {
      console.log('🗜️ Decompressing gzipped CSV file...');
      
      // Descomprimir el archivo gzip
      const decompressedText = await this.decompressGzip(file);
      const lines = decompressedText.split('\n');
      
      // Skip header line
      const wordsData = lines.slice(1).filter(line => line.trim().length > 0);
      this.totalWords = wordsData.length;
      
      console.log(`CSV file loaded with ${this.totalWords} lines`);
      
      if (this.totalWords === 0) {
        console.error('CSV file contains no words');
        return false;
      }
      
      // Process in smaller chunks (now 1000 instead of 10000)
      const chunks: string[][] = [];
      for (let i = 0; i < wordsData.length; i += CHUNK_SIZE) {
        chunks.push(wordsData.slice(i, i + CHUNK_SIZE));
      }
      
      console.log(`Processing ${chunks.length} chunks of ${CHUNK_SIZE} words each`);
      
      for (let i = 0; i < chunks.length; i++) {
        if (this.abortController?.signal.aborted) {
          console.log('CSV processing aborted');
          return false;
        }
        
        const chunkWords = chunks[i].map(line => {
          // Extract columns from CSV line
          // Format: alphagram,word,length (ignoring other columns if present)
          const columns = line.split(',');
          
          if (columns.length < 3) return null;
          
          const alphagram = columns[0].trim().replace(/"/g, '');
          const word = columns[1].trim().replace(/"/g, '');
          const length = parseInt(columns[2].trim());
          
          // Validate data integrity
          if (!word || !alphagram || isNaN(length)) return null;
          
          return {
            alphagram: alphagram.toUpperCase(),
            word: word.toUpperCase(),
            length: length
          };
        }).filter(wordData => wordData !== null);
        
        try {
          // Asegurar que SQLite esté inicializada antes de usar
          await sqliteDB.init();
          await sqliteDB.addWords(chunkWords);
          
          this.processedWords += chunkWords.length;
          console.log(`Processed chunk ${i+1}/${chunks.length}, total: ${this.processedWords}/${this.totalWords} words`);
          
          // Add a small cooling period between chunks to prevent overheating
          if (i < chunks.length - 1 && COOLING_PERIOD_MS > 0) {
            await new Promise(resolve => setTimeout(resolve, COOLING_PERIOD_MS));
          }
        } catch (error) {
          console.error(`Error processing chunk ${i+1}:`, error);
          // Continue with next chunk despite errors in current chunk
          // But notify about the issue
          if (error instanceof Error && error.name === 'QuotaExceededError') {
            console.error('Storage quota exceeded. Consider clearing some browser data.');
            toast.error('Error: Espacio de almacenamiento excedido');
            return false;
          }
        }
      }
      
      console.log('CSV processing complete');
      
      // Auto-cache SQLite database después de construcción exitosa
      try {
        await sqliteDB.saveToCache();
        console.log('💾 SQLite auto-cached after CSV load');
      } catch (cacheError) {
        console.warn('⚠️ Failed to auto-cache SQLite:', cacheError);
      }
      
      return true;
      
    } catch (error) {
      console.error('Error processing CSV file:', error);
      toast.error('Error procesando el diccionario');
      return false;
    }
  }

  /**
   * Descomprimir archivo gzip usando la API nativa del navegador
   */
  private async decompressGzip(gzipBlob: Blob): Promise<string> {
    try {
      // Usar DecompressionStream API nativa del navegador
      const decompressStream = new DecompressionStream('gzip');
      const stream = gzipBlob.stream().pipeThrough(decompressStream);
      
      // Convertir stream a blob y luego a texto
      const response = new Response(stream);
      const decompressedBlob = await response.blob();
      const text = await decompressedBlob.text();
      
      console.log(`✅ Decompression complete: ${gzipBlob.size} bytes → ${text.length} chars`);
      return text;
    } catch (error) {
      console.error('❌ Gzip decompression failed:', error);
      
      // Fallback: asumir que es texto plano
      console.log('🔄 Fallback: treating as plain text');
      return await gzipBlob.text();
    }
  }
}
