import React from 'react';
import { AnagramWordInfo } from '@/utils/anagramWordData';
import { getVerbForms, getVerbTypeLabel, getRegularityLabel, VerbForms } from '@/utils/verbData';

interface VerbWordViewProps {
  word: string;
  wordInfo: AnagramWordInfo;
  highlightedWord?: React.ReactNode;
}

const VerbWordView: React.FC<VerbWordViewProps> = ({
  word,
  wordInfo,
  highlightedWord
}) => {
  const handleRAEClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://dle.rae.es/${word.toLowerCase()}`, '_blank');
  };

  const formatLemmaWithSuperscript = (lemma: string) => {
    // Check if lemma ends with a digit for homonymy
    const match = lemma.match(/^(.+?)(\d+)$/);
    if (match) {
      const [, base, digit] = match;
      return (
        <>
          {base}
          <sup>{digit}</sup>
        </>
      );
    }
    return lemma;
  };

  const getVerbTypeColor = (verbTypeLabel: string) => {
    if (verbTypeLabel.includes('transitivo') && !verbTypeLabel.includes('intransitivo')) {
      return 'bg-green-100 text-green-700'; // Verde para transitivo
    }
    if (verbTypeLabel.includes('intransitivo') && !verbTypeLabel.includes('transitivo')) {
      return 'bg-lime-100 text-lime-700'; // Lima para intransitivo
    }
    if (verbTypeLabel.includes('pronominal')) {
      return 'bg-yellow-100 text-yellow-700'; // Amarillo para pronominal
    }
    if (verbTypeLabel.includes('defectivo')) {
      return 'bg-orange-100 text-orange-800'; // Naranja para defectivo con buen contraste
    }
    if (verbTypeLabel.includes('no conj.')) {
      return 'bg-red-100 text-red-700'; // Rojo para no conjugable
    }
    if (verbTypeLabel.includes('transitivo') && verbTypeLabel.includes('intransitivo')) {
      return 'bg-teal-100 text-teal-700'; // Teal para transitivo/intransitivo
    }
    return 'bg-gray-100 text-gray-700'; // Default
  };

  if (!wordInfo.verbInfo) return null;

  const verbInfo = wordInfo.verbInfo;
  const verbForms = getVerbForms(verbInfo);
  const verbTypeLabel = getVerbTypeLabel(verbInfo);
  const regularityLabel = getRegularityLabel(verbInfo.regularity);

  const renderVerbForm = (form: { form: string; isValid: boolean }, label: string) => {
    return (
      <span
        key={form.form}
        className={`inline-block px-2 py-1 text-xs rounded-full mr-1 mb-1 ${
          form.isValid 
            ? 'bg-green-100 text-green-700' 
            : 'bg-red-100 text-red-700 line-through'
        }`}
        title={form.isValid ? `${label} - Válida para Scrabble` : `${label} - No válida para Scrabble`}
      >
        {form.form.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Clickable word with verb info */}
      <div className="mb-3">
        <span 
          onClick={handleRAEClick}
          className="font-medium text-lg cursor-pointer hover:text-blue-600 transition-colors"
        >
          {highlightedWord || word}
          <span className="text-sm font-normal text-blue-600 ml-1">
            ({wordInfo.wordType === 'conjugación' ? 'conjug.' : wordInfo.wordType} de <strong>"{formatLemmaWithSuperscript(wordInfo.lemma || verbInfo.norm_lemma)}"</strong>, <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getVerbTypeColor(verbTypeLabel)}`}>verbo {verbTypeLabel}</span>, {regularityLabel})
          </span>
        </span>
      </div>

      {/* Verb definition */}
      {verbInfo.prime_sense && (
        <div className="text-xs text-gray-600 italic mb-3 leading-relaxed">
          "{verbInfo.prime_sense}"
        </div>
      )}

      {/* Verb forms */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-700 mb-2">
          Formas derivadas:
        </div>
        
        <div className="flex flex-wrap items-center">
          {verbForms.masculineParticiple && 
            renderVerbForm(verbForms.masculineParticiple, 'Participio masculino')
          }
          
          {verbForms.masculinePluralParticiple && 
            renderVerbForm(verbForms.masculinePluralParticiple, 'Participio masculino plural')
          }
          
          {verbForms.feminineParticiple && 
            renderVerbForm(verbForms.feminineParticiple, 'Participio femenino')
          }
          
          {verbForms.pronominalForm && 
            renderVerbForm(verbForms.pronominalForm, 'Forma pronominal')
          }
          
          {verbForms.imperativeForm && 
            renderVerbForm(verbForms.imperativeForm, 'Imperativo voseo')
          }
        </div>

      </div>
    </div>
  );
};

export default VerbWordView;