
import { Progress } from "@/components/ui/progress";
import { LoadingStage } from "@/hooks/useWordDatabase";

interface LoadingIndicatorProps {
  progress: number;
  stage?: LoadingStage;
}

const LoadingIndicator = ({ 
  progress, 
  stage = 'processing'
}: LoadingIndicatorProps) => {

  const getStageText = (): string => {
    switch (stage) {
      case 'initializing':
        return 'Iniciando aplicación';
      case 'download':
        return 'Descargando diccionario';
      case 'processing':
        return 'Procesando diccionario';
      case 'building':
        return 'Preparando diccionario';
      case 'complete':
        return 'Diccionario listo';
      default:
        return 'Cargando diccionario';
    }
  };

  const getIndicatorColor = (): string => {
    switch (stage) {
      case 'initializing':
        return 'bg-gray-400';
      case 'download':
        return 'bg-blue-500';
      case 'processing':
        return 'bg-green-500';
      case 'building':
        return 'bg-amber-500';
      case 'complete':
        return 'bg-green-600';
      default:
        return 'bg-primary';
    }
  };

  return (
    <div className="space-y-2">
      <Progress value={progress} indicatorColor={getIndicatorColor()} className="w-full" />
      <div className="flex justify-between text-sm text-gray-500">
        <p>{getStageText()} ({Math.floor(progress)}%)</p>
      </div>
    </div>
  );
};

export default LoadingIndicator;
