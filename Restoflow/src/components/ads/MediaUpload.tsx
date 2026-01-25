import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Music, Video, FileText, AlertCircle, CheckCircle, Play, Pause } from 'lucide-react';
import { 
  compressImage, 
  compressAudio, 
  compressVideo,
  fileToBase64, 
  validateFile, 
  formatFileSize,
  generateThumbnail 
} from '../../utils/mediaCompression';

interface MediaUploadProps {
  onImageUpload: (base64: string, file: File) => void;
  onAudioUpload: (base64: string, file: File) => void;
  onVideoUpload: (base64: string, file: File) => void;
  onRemoveImage: () => void;
  onRemoveAudio: () => void;
  onRemoveVideo: () => void;
  currentImage?: string;
  currentAudio?: string;
  currentVideo?: string;
  maxImageSizeMB?: number;
  maxAudioSizeMB?: number;
  maxVideoSizeMB?: number;
}

const MediaUpload: React.FC<MediaUploadProps> = ({
  onImageUpload,
  onAudioUpload,
  onVideoUpload,
  onRemoveImage,
  onRemoveAudio,
  onRemoveVideo,
  currentImage,
  currentAudio,
  currentVideo,
  maxImageSizeMB = 5,
  maxAudioSizeMB = 10,
  maxVideoSizeMB = 15,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(currentImage || null);
  const [audioPreview, setAudioPreview] = useState<string | null>(currentAudio || null);
  const [videoPreview, setVideoPreview] = useState<string | null>(currentVideo || null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const allowedAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'];
  const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov'];

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Validate file
      const validation = validateFile(file, allowedImageTypes, maxImageSizeMB);
      if (!validation.isValid) {
        setError(validation.error || 'Invalid file');
        return;
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      // Compress image
      const compressedFile = await compressImage(file);
      
      // Generate thumbnail
      const thumbnail = await generateThumbnail(compressedFile);
      setImagePreview(thumbnail);

      // Convert to base64
      const base64 = await fileToBase64(compressedFile);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      onImageUpload(base64, compressedFile);
      
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);

    } catch (error) {
      console.error('Error uploading image:', error);
      setError('Failed to upload image. Please try again.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Validate file
      const validation = validateFile(file, allowedAudioTypes, maxAudioSizeMB);
      if (!validation.isValid) {
        setError(validation.error || 'Invalid file');
        return;
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      // Compress audio
      const compressedFile = await compressAudio(file);
      setAudioPreview(URL.createObjectURL(compressedFile));

      // Convert to base64
      const base64 = await fileToBase64(compressedFile);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      onAudioUpload(base64, compressedFile);
      
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);

    } catch (error) {
      console.error('Error uploading audio:', error);
      setError('Failed to upload audio. Please try again.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    onRemoveImage();
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Validate file
      const validation = validateFile(file, allowedVideoTypes, maxVideoSizeMB);
      if (!validation.isValid) {
        setError(validation.error || 'Invalid file');
        return;
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      // Compress video
      const compressedFile = await compressVideo(file);
      setVideoPreview(URL.createObjectURL(compressedFile));

      // Convert to base64
      const base64 = await fileToBase64(compressedFile);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      onVideoUpload(base64, compressedFile);
      
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);

    } catch (error) {
      console.error('Error uploading video:', error);
      setError('Failed to upload video. Please try again.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveAudio = () => {
    setAudioPreview(null);
    onRemoveAudio();
    if (audioInputRef.current) {
      audioInputRef.current.value = '';
    }
  };

  const handleRemoveVideo = () => {
    setVideoPreview(null);
    setIsVideoPlaying(false);
    onRemoveVideo();
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  const toggleVideoPlay = () => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsVideoPlaying(!isVideoPlaying);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-700 font-medium">Uploading...</span>
            <span className="text-blue-700">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Image Upload Section */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Advertisement Image
        </label>
        
        {imagePreview ? (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Ad preview"
              className="w-full h-48 object-cover rounded-lg border border-gray-200"
            />
            <button
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
            >
              <X size={16} />
            </button>
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
              <CheckCircle size={12} className="inline mr-1" />
              Image uploaded
            </div>
          </div>
        ) : (
          <div
            onClick={() => imageInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 cursor-pointer transition-colors"
          >
            <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-2">
              <p className="text-sm text-gray-600">
                Click to upload an image
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PNG, JPG, WEBP up to {maxImageSizeMB}MB
              </p>
            </div>
          </div>
        )}
        
        <input
          ref={imageInputRef}
          type="file"
          accept={allowedImageTypes.join(',')}
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      {/* Audio Upload Section */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Advertisement Audio (Optional)
        </label>
        
        {audioPreview ? (
          <div className="relative bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Music className="h-8 w-8 text-blue-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Audio uploaded</p>
                  <p className="text-xs text-gray-500">Ready to play</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <audio controls className="h-8">
                  <source src={audioPreview} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
                <button
                  onClick={handleRemoveAudio}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            onClick={() => audioInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 cursor-pointer transition-colors"
          >
            <Music className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-2">
              <p className="text-sm text-gray-600">
                Click to upload audio
              </p>
              <p className="text-xs text-gray-500 mt-1">
                MP3, WAV, OGG, M4A up to {maxAudioSizeMB}MB
              </p>
            </div>
          </div>
        )}
        
        <input
          ref={audioInputRef}
          type="file"
          accept={allowedAudioTypes.join(',')}
          onChange={handleAudioUpload}
          className="hidden"
        />
      </div>

      {/* Video Upload Section */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Advertisement Video (Optional)
        </label>
        
        {videoPreview ? (
          <div className="relative bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Video className="h-8 w-8 text-purple-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Video uploaded</p>
                  <p className="text-xs text-gray-500">Ready to play</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleVideoPlay}
                  className="p-2 bg-purple-500 text-white rounded-full hover:bg-purple-600 transition-colors"
                  title={isVideoPlaying ? 'Pause' : 'Play'}
                >
                  {isVideoPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button
                  onClick={handleRemoveVideo}
                  className="text-red-500 hover:text-red-700 p-1"
                  title="Remove Video"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="mt-3">
              <video
                ref={videoRef}
                src={videoPreview}
                className="w-full h-48 object-cover rounded-lg"
                controls
                onPlay={() => setIsVideoPlaying(true)}
                onPause={() => setIsVideoPlaying(false)}
              />
            </div>
          </div>
        ) : (
          <div
            onClick={() => videoInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 cursor-pointer transition-colors"
          >
            <Video className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-2">
              <p className="text-sm text-gray-600">
                Click to upload video
              </p>
              <p className="text-xs text-gray-500 mt-1">
                MP4, WebM, OGG, AVI, MOV up to {maxVideoSizeMB}MB
              </p>
            </div>
          </div>
        )}
        
        <input
          ref={videoInputRef}
          type="file"
          accept={allowedVideoTypes.join(',')}
          onChange={handleVideoUpload}
          className="hidden"
        />
      </div>

      {/* File Requirements */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">File Requirements</h4>
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex items-center">
            <FileText size={12} className="mr-2" />
            <span>Images: PNG, JPG, WEBP (max {maxImageSizeMB}MB)</span>
          </div>
          <div className="flex items-center">
            <FileText size={12} className="mr-2" />
            <span>Audio: MP3, WAV, OGG, M4A (max {maxAudioSizeMB}MB)</span>
          </div>
          <div className="flex items-center">
            <FileText size={12} className="mr-2" />
            <span>Videos: MP4, WebM, OGG, AVI, MOV (max {maxVideoSizeMB}MB)</span>
          </div>
          <div className="flex items-center">
            <FileText size={12} className="mr-2" />
            <span>Files are automatically compressed for optimal performance</span>
          </div>
          <div className="flex items-center">
            <FileText size={12} className="mr-2" />
            <span>Videos are resized to max 1280x720 for better performance</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaUpload;
