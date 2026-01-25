import React, { useState } from 'react';
import { X, Play, Pause, Volume2, VolumeX, Calendar, Clock, MapPin, Star, Heart, Share2 } from 'lucide-react';

interface AdPopupTemplateProps {
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
  onClose: () => void;
  onReserve: () => void;
}

const AdPopupTemplate: React.FC<AdPopupTemplateProps> = ({ ad, onClose, onReserve }) => {
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

  const handleMute = () => {
    setIsMuted(!isMuted);
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
      // Fallback for browsers that don't support Web Share API
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 sm:p-6">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 text-white hover:text-gray-200 transition-colors"
          >
            <X size={20} className="sm:w-6 sm:h-6" />
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="pr-8">
              <h2 className="text-xl sm:text-2xl font-bold mb-2">🎉 Your Ad is Live!</h2>
              <p className="text-blue-100 text-sm sm:text-base">This is how your advertisement appears to customers</p>
            </div>
            <div className="text-left sm:text-right mt-3 sm:mt-0">
              <div className="text-xs sm:text-sm text-blue-100">Advertisement Preview</div>
              <div className="text-base sm:text-lg font-semibold">Public Menu Display</div>
            </div>
          </div>
        </div>

        {/* Ad Content */}
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Media Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Media Content</h3>
              
              {/* Image Display */}
              {ad.imageBase64 && (
                <div className="relative group">
                  <img
                    src={ad.imageBase64}
                    alt={ad.title}
                    className="w-full h-64 object-cover rounded-xl shadow-lg"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 rounded-xl flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button className="bg-white bg-opacity-90 text-gray-800 px-4 py-2 rounded-full hover:bg-opacity-100 transition-all">
                        <Share2 size={16} className="inline mr-2" />
                        Share
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Video Display */}
              {ad.videoBase64 && (
                <div className="relative group">
                  <video
                    src={ad.videoBase64}
                    className="w-full h-64 object-cover rounded-xl shadow-lg"
                    poster={ad.imageBase64}
                    controls={isVideoPlaying}
                  />
                  {!isVideoPlaying && (
                    <div className="absolute inset-0 bg-black bg-opacity-30 rounded-xl flex items-center justify-center">
                      <button
                        onClick={handleVideoPlay}
                        className="bg-white bg-opacity-90 text-gray-800 p-4 rounded-full hover:bg-opacity-100 transition-all transform hover:scale-110"
                      >
                        <Play size={24} fill="currentColor" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Audio Display */}
              {ad.audioBase64 && (
                <div className="bg-gray-50 rounded-xl p-4 border-2 border-dashed border-gray-200">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={handleAudioPlay}
                      className="bg-blue-500 text-white p-3 rounded-full hover:bg-blue-600 transition-colors"
                    >
                      {isAudioPlaying ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
                    </button>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">Audio Advertisement</div>
                      <div className="text-xs text-gray-500">Click to play audio content</div>
                    </div>
                    <button
                      onClick={handleMute}
                      className="text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>
                  </div>
                  {isAudioPlaying && (
                    <audio
                      src={ad.audioBase64}
                      autoPlay
                      muted={isMuted}
                      className="w-full mt-2"
                    />
                  )}
                </div>
              )}

              {/* No Media Fallback */}
              {!ad.imageBase64 && !ad.videoBase64 && !ad.audioBase64 && (
                <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl p-8 text-center">
                  <div className="text-gray-400 mb-2">
                    <Calendar size={48} className="mx-auto" />
                  </div>
                  <div className="text-gray-600 font-medium">No Media Content</div>
                  <div className="text-sm text-gray-500">Text-only advertisement</div>
                </div>
              )}
            </div>

            {/* Content Section */}
            <div className="space-y-6">
              {/* Ad Title & Description */}
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-3">{ad.title}</h1>
                <p className="text-gray-600 leading-relaxed">{ad.description}</p>
              </div>


              {/* Restaurant Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <MapPin size={16} className="text-gray-500 mr-2" />
                  <span className="text-sm font-medium text-gray-700">Restaurant Information</span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Clock size={14} className="mr-2" />
                    <span>Open Now • Closes at 10:00 PM</span>
                  </div>
                  <div className="flex items-center">
                    <Star size={14} className="mr-2 text-yellow-500" />
                    <span>4.8 (127 reviews)</span>
                  </div>
                </div>
              </div>

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

              {/* Ad Details */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="text-sm text-yellow-800">
                  <div className="font-medium mb-1">Advertisement Details</div>
                  <div className="space-y-1">
                    <div>Target: {ad.targetAudience.replace('_', ' ')}</div>
                    <div>Duration: {ad.duration} days</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-t">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
            <div className="text-xs sm:text-sm text-gray-600">
              This is a preview of how your advertisement appears to customers
            </div>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm sm:text-base"
              >
                Close Preview
              </button>
              <button
                onClick={onReserve}
                className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm sm:text-base"
              >
                Test Reservation
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdPopupTemplate;
