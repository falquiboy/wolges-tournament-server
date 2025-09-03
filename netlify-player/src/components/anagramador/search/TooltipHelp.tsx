
import { HelpCircle } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

interface TooltipHelpProps {
  isPatternMode: boolean;
}

const TooltipHelp = ({
  isPatternMode
}: TooltipHelpProps) => {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button className="flex items-center justify-center w-8 h-8 text-gray-500 hover:text-gray-700 mt-1" aria-label="Ayuda de patrones">
          <HelpCircle className="h-5 w-5" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 p-2 text-sm">
        <p className="mb-1 font-medium">Patrones de búsqueda:</p>
        <ul className="space-y-1 text-xs">
          <li><code>-AR</code>: palabras que <b>terminan</b> con "AR"</li>
          <li><code>CO-</code>: palabras que <b>empiezan</b> con "CO"</li>
          <li><code>-CI-</code>: palabras que <b>contienen</b> "CI" (en cualquier posición)</li>
          <li><code>.</code>: una letra cualquiera <b>en posición definida</b></li>
          <li><code>*</code>: <b>cero o más letras</b> (expansión variable)</li>
          <li><code>?</code>: representa una <b>ficha comodín</b> (cualquier letra)</li>
          <li><code>-AR:6</code>: palabras de <b>exactamente 6 letras</b> que terminan con "AR"</li>
          <li><code>.R..C...,AEOSNT</code>: <b>patrones + fichas</b> - usar las letras "AEOSNT" para completar el patrón ".R..C..." (TRONCASE)</li>
          <li><code>CO*</code>: palabras que <b>empiezan</b> con "CO" y pueden tener más letras</li>
          <li><code>-PUCH-R</code>: palabras que <b>contienen</b> "PUCH" y <b>terminan</b> con "R"</li>
        </ul>
        <p className="mt-1 text-xs text-gray-500">Por defecto muestra palabras de hasta 8 letras. Usa el interruptor para ver palabras más largas, o agrega <code>:N</code> para filtrar por longitud exacta.</p>
      </HoverCardContent>
    </HoverCard>
  );
};

export default TooltipHelp;
