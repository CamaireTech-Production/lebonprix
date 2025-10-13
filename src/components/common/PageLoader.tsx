import { Loader2 } from 'lucide-react';

const PageLoader = () => {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center">
        <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
        <p className="mt-2 text-gray-600 text-sm">Loading page...</p>
      </div>
    </div>
  );
};

export default PageLoader;
