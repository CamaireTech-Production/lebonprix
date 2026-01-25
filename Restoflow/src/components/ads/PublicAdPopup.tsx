import React, { useState } from 'react';
import { X, Play, Pause, Volume2, VolumeX, Calendar, Clock, MapPin, Star, Heart, Share2 } from 'lucide-react';

interface PublicAdPopupProps {
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
    address?: string;
    phone?: string;
    rating?: number;
    reviewCount?: number;
    isOpen?: boolean;
    closingTime?: string;
  };
  onClose: () => void;
  onReserve: () => void;
}

const PublicAdPopup: React.FC<PublicAdPopupProps> = ({ ad, restaurant, onClose, onReserve }) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  const handleVideoPlay = () => {
    setIsVideoPlaying(!isVideoPlaying);
  };

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm sm:max-w-2xl lg:max-w-4xl w-full max-h-[80vh] sm:max-h-[90vh] overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-colors"
        >
          <X size={20} className="text-gray-600" />
        </button>

        {/* Ad Content */}
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Media Content */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Media Content</h3>
              
              {/* Image Display */}
              {ad.imageBase64 && (
                <div className="relative bg-gray-50 rounded-lg overflow-hidden">
                  <img
                    src={ad.imageBase64}
                    alt={ad.title}
                    className="w-full h-64 object-cover"
                  />
                </div>
              )}

              {/* Video Display */}
              {ad.videoBase64 && (
                <div className="relative bg-gray-50 rounded-lg overflow-hidden">
                  <video
                    src={ad.videoBase64}
                    className="w-full h-64 object-cover"
                    controls
                    onPlay={() => setIsVideoPlaying(true)}
                    onPause={() => setIsVideoPlaying(false)}
                  />
                </div>
              )}

              {/* Audio Display */}
              {ad.audioBase64 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleAudioPlay}
                      className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-3 transition-colors"
                    >
                      {isAudioPlaying ? <Pause size={20} /> : <Play size={20} />}
                    </button>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">Audio Advertisement</div>
                      <div className="text-xs text-gray-500">Click to play</div>
                    </div>
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>
                  </div>
                  <audio
                    src={ad.audioBase64}
                    muted={isMuted}
                    onPlay={() => setIsAudioPlaying(true)}
                    onPause={() => setIsAudioPlaying(false)}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            {/* Ad Details and Actions */}
            <div className="space-y-6">
              {/* Ad Title and Description */}
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{ad.title}</h2>
                <p className="text-gray-600 text-lg">{ad.description}</p>
              </div>

              {/* Restaurant Information */}
              {restaurant && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <MapPin size={16} className="text-gray-500" />
                    <span className="font-medium text-gray-900">Restaurant Information</span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <Clock size={14} className="text-gray-400" />
                      <span>{restaurant.isOpen ? 'Open Now' : 'Closed'} • Closes at {restaurant.closingTime || '10:00 PM'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Star size={14} className="text-yellow-400 fill-current" />
                      <span>{restaurant.rating || '4.8'} ({restaurant.reviewCount || '127'} reviews)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={onReserve}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-bold py-3 sm:py-4 px-4 sm:px-6 rounded-xl hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl text-sm sm:text-base"
                >
                  <Calendar size={18} className="inline mr-2" />
                  Make Reservation
                </button>
                
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                  <button
                    onClick={handleLike}
                    className={`flex-1 py-2 sm:py-3 px-3 sm:px-4 rounded-lg border-2 transition-all text-sm sm:text-base ${
                      isLiked 
                        ? 'border-red-500 text-red-500 bg-red-50' 
                        : 'border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-500'
                    }`}
                  >
                    <Heart size={14} className={`inline mr-2 ${isLiked ? 'fill-current' : ''}`} />
                    {isLiked ? 'Liked' : 'Like'}
                  </button>
                  
                  <button
                    onClick={handleShare}
                    className="flex-1 py-2 sm:py-3 px-3 sm:px-4 rounded-lg border-2 border-gray-300 text-gray-600 hover:border-blue-300 hover:text-blue-500 transition-all text-sm sm:text-base"
                  >
                    <Share2 size={14} className="inline mr-2" />
                    Share
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4">
          <p className="text-xs sm:text-sm text-gray-500 text-center">
            This is an advertisement from {restaurant?.name || 'this restaurant'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PublicAdPopup;
