import React, { useState } from 'react';
import { Play, Pause, Calendar, Heart, Share2 } from 'lucide-react';

interface CompactAdCardProps {
  ad: {
    id: string;
    title: string;
    description: string;
    imageBase64?: string;
    audioBase64?: string;
    videoBase64?: string;
    targetAudience: string;
    duration: number;
  };
  restaurant?: {
    name?: string;
  };
  onReserve: () => void;
}

const CompactAdCard: React.FC<CompactAdCardProps> = ({ ad, onReserve }) => {
  console.log('CompactAdCard - Rendering ad:', ad);
  
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  const handleAudioPlay = () => {
    setIsAudioPlaying(!isAudioPlaying);
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: ad.title,
        text: ad.description,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="bg-white border border-blue-200 rounded-lg p-3 my-4 shadow-sm w-full max-w-2xl mx-auto">
      {/* Ad Header - Very Compact */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1"></div>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-semibold text-blue-700">🎉 OFFER</span>
        </div>
        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Announcement</span>
      </div>

      {/* Main Content Layout: 2 Grids - 40% Image, 60% Content */}
      <div className="grid grid-cols-10 gap-3">
        {/* Left Grid - Image Section (40%) - Centered */}
        <div className="col-span-4 flex items-center justify-center">
          {ad.imageBase64 && (
            <div className="relative bg-gray-50 rounded-md overflow-hidden w-full max-w-20 flex items-center justify-center">
              <img
                src={ad.imageBase64}
                alt={ad.title}
                className="w-full aspect-[9/16] object-cover rounded-md"
              />
            </div>
          )}
          
          {ad.videoBase64 && (
            <div className="relative bg-gray-50 rounded-md overflow-hidden w-full max-w-20 flex items-center justify-center">
              <video
                src={ad.videoBase64}
                className="w-full aspect-[9/16] object-cover rounded-md"
                controls={false}
                preload="metadata"
              />
            </div>
          )}

          {ad.audioBase64 && !ad.videoBase64 && !ad.imageBase64 && (
            <div className="bg-gray-50 rounded-md p-2 w-full max-w-20 aspect-[9/16] flex items-center justify-center">
              <button
                onClick={handleAudioPlay}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 transition-colors"
              >
                {isAudioPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <audio
                src={ad.audioBase64}
                onPlay={() => setIsAudioPlaying(true)}
                onPause={() => setIsAudioPlaying(false)}
                className="hidden"
              />
            </div>
          )}

          {!ad.imageBase64 && !ad.videoBase64 && !ad.audioBase64 && (
            <div className="w-full max-w-20 aspect-[9/16] bg-gray-100 rounded-md flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="text-lg">📢</div>
              </div>
            </div>
          )}
        </div>

        {/* Right Grid - Content Section (60%) */}
        <div className="col-span-6 space-y-3">
          {/* Title and Description */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 line-clamp-1">{ad.title}</h3>
            <p className="text-xs text-gray-600 line-clamp-2 leading-tight">{ad.description}</p>
          </div>

          {/* Reservation Button - With proper spacing */}
          <div className="pt-2">
            <button
              onClick={onReserve}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-3 rounded-md transition-colors flex items-center justify-center space-x-1 text-sm"
            >
              <Calendar size={12} />
              <span>Reserve</span>
            </button>
          </div>

          {/* Social Actions - Very Small */}
          <div className="flex space-x-1">
            <button
              onClick={handleLike}
              className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
                isLiked 
                  ? 'bg-red-100 text-red-600' 
                  : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500'
              }`}
            >
              <Heart size={10} className={isLiked ? 'fill-current' : ''} />
              <span>{isLiked ? 'Liked' : 'Like'}</span>
            </button>
            
            <button
              onClick={handleShare}
              className="flex items-center space-x-1 px-2 py-1 bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-500 rounded text-xs transition-colors"
            >
              <Share2 size={10} />
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompactAdCard;
