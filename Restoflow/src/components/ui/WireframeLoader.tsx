import React from 'react';

interface WireframeLoaderProps {
    count?: number;
}


const WireframeLoader: React.FC<WireframeLoaderProps> = ({ count = 8 }) => {
    const loaders = Array.from({ length: count });
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
            {loaders.map((_, index) => (
                <div key={index} className="animate-pulse bg-white rounded-lg p-4 shadow-sm">
                    <div className="bg-gray-200 rounded-lg h-32 md:h-48 w-full"></div>
                    <div className="mt-4 h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="mt-2 h-4 bg-gray-200 rounded w-1/2"></div>
                    <div className="mt-4 h-8 bg-gray-200 rounded w-32"></div>
                </div>
            ))}
        </div>
    );
};

export default WireframeLoader;