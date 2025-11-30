import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen = ({ message = 'Loading...' }: LoadingScreenProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center">
        <Loader2 className="h-12 w-12 text-emerald-500 animate-spin" />
        <p className="mt-4 text-gray-700 font-medium">{message}</p>
      </div>
    </div>
  );
};

export default LoadingScreen;