import { supabase } from "@/integrations/supabase/client";

export interface VerbInfo {
  entry_key: number;
  norm_lemma: string;
  prime_sense: string;
  prime_type: string;
  regularity: string;
  participle_masculine?: string;
  has_participle_masculine?: boolean;
  participle_masculine_plural?: string;
  has_participle_masculine_plural?: boolean;
  participle_feminine?: string;
  has_participle_feminine?: boolean;
  prnl_end?: string;
  voseo_imperative_plural?: string;
  has_voseo_imperative?: boolean;
  is_prnl_end?: boolean;
}

export interface VerbForms {
  masculineParticiple?: { form: string; isValid: boolean };
  masculinePluralParticiple?: { form: string; isValid: boolean };
  feminineParticiple?: { form: string; isValid: boolean };
  pronominalForm?: { form: string; isValid: boolean };
  imperativeForm?: { form: string; isValid: boolean };
}

/**
 * Fetch multiple verb infos in a single batch query (NEW - Performance optimization)
 * Mismo patrón que funcionó para leaves y hooks
 */
export async function fetchBatchVerbInfo(lemmas: string[]): Promise<Map<string, VerbInfo | null>> {
  const results = new Map<string, VerbInfo | null>();
  
  if (lemmas.length === 0) return results;
  
  try {
    console.log(`🚀 fetchBatchVerbInfo: querying ${lemmas.length} lemmas in single batch`);
    
    // Batch query para todos los lemmas
    const { data, error } = await supabase
      .from('verb_entries')
      .select(`
        entry_key,
        norm_lemma,
        prime_sense,
        prime_type,
        regularity,
        participle_masculine,
        has_participle_masculine,
        participle_masculine_plural,
        has_participle_masculine_plural,
        participle_feminine,
        has_participle_feminine,
        prnl_end,
        voseo_imperative_plural,
        has_voseo_imperative,
        is_prnl_end
      `)
      .in('norm_lemma', lemmas.map(l => l.toLowerCase()));

    if (error) {
      console.error('❌ Error in batch verb query:', error);
      // Mark all as null on error
      lemmas.forEach(lemma => results.set(lemma, null));
      return results;
    }

    // Process results
    const foundLemmas = new Set<string>();
    
    if (data && data.length > 0) {
      data.forEach(verbInfo => {
        results.set(verbInfo.norm_lemma, verbInfo);
        foundLemmas.add(verbInfo.norm_lemma);
        
        // Also add uppercase version for lookup flexibility
        results.set(verbInfo.norm_lemma.toUpperCase(), verbInfo);
      });
    }

    // Mark not found lemmas as null
    lemmas.forEach(lemma => {
      const lowerLemma = lemma.toLowerCase();
      if (!foundLemmas.has(lowerLemma)) {
        results.set(lemma, null);
        results.set(lowerLemma, null);
      }
    });

    console.log(`✅ Batch verb query: ${data?.length || 0} verbs found out of ${lemmas.length} lemmas`);
    
    return results;
  } catch (error) {
    console.error('❌ Exception in batch verb query:', error);
    // Fallback: mark all as null
    lemmas.forEach(lemma => results.set(lemma, null));
    return results;
  }
}

export async function fetchVerbInfo(lemma: string): Promise<VerbInfo | null> {
  try {
    console.log('🔍 Fetching verb info for:', lemma);
    
    const { data, error } = await supabase
      .from('verb_entries')
      .select(`
        entry_key,
        norm_lemma,
        prime_sense,
        prime_type,
        regularity,
        participle_masculine,
        has_participle_masculine,
        participle_masculine_plural,
        has_participle_masculine_plural,
        participle_feminine,
        has_participle_feminine,
        prnl_end,
        voseo_imperative_plural,
        has_voseo_imperative,
        is_prnl_end
      `)
      .eq('norm_lemma', lemma.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - not a verb
        console.log('📝 Word not found in verb_entries:', lemma);
        return null;
      }
      console.error('❌ Error fetching verb info:', error);
      return null;
    }

    console.log('✅ Verb info found:', data);
    return data;

  } catch (error) {
    console.error('❌ Exception fetching verb info:', error);
    return null;
  }
}

export async function checkIfWordIsVerb(word: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('verb_entries')
      .select('entry_key')
      .eq('norm_lemma', word.toLowerCase())
      .single();

    return !error && !!data;
  } catch {
    return false;
  }
}

export function getVerbForms(verbInfo: VerbInfo): VerbForms {
  const forms: VerbForms = {};

  if (verbInfo.participle_masculine) {
    forms.masculineParticiple = {
      form: verbInfo.participle_masculine,
      isValid: verbInfo.has_participle_masculine ?? false
    };
  }

  if (verbInfo.participle_masculine_plural) {
    forms.masculinePluralParticiple = {
      form: verbInfo.participle_masculine_plural,
      isValid: verbInfo.has_participle_masculine_plural ?? false
    };
  }

  if (verbInfo.participle_feminine) {
    forms.feminineParticiple = {
      form: verbInfo.participle_feminine,
      isValid: verbInfo.has_participle_feminine ?? false
    };
  }

  if (verbInfo.prnl_end) {
    forms.pronominalForm = {
      form: verbInfo.prnl_end,
      isValid: verbInfo.is_prnl_end ?? true // Default to true if not specified
    };
  }

  if (verbInfo.voseo_imperative_plural) {
    forms.imperativeForm = {
      form: verbInfo.voseo_imperative_plural,
      isValid: verbInfo.has_voseo_imperative ?? false
    };
  }

  return forms;
}

export function getVerbTypeLabel(verbInfo: VerbInfo): string {
  const typeMap: Record<string, string> = {
    'tr.': 'transitivo',
    'intr.': 'intransitivo', 
    'prnl.': 'pronominal',
    'defect.': 'defectivo',
    'tr./intr.': 'transitivo/intransitivo',
    'tr./prnl.': 'transitivo/pronominal',
    'intr./prnl.': 'intransitivo/pronominal'
  };

  return typeMap[verbInfo.prime_type] || verbInfo.prime_type;
}

export function getRegularityLabel(regularity: string): string {
  const regMap: Record<string, string> = {
    'reg.': 'regular',
    'irreg.': 'irregular',
    'irreg./part.irreg.': 'irregular/part. irreg.',
    'part.irreg.': 'participio irregular'
  };

  return regMap[regularity] || regularity;
}