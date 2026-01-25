import React from 'react';
import { Clock, Mail, Phone, AlertCircle, CheckCircle, XCircle, MessageCircle } from 'lucide-react';
import { Restaurant } from '../../types';

interface VerificationPendingProps {
  restaurant: Restaurant;
  onLogout: () => void;
}

const VerificationPending: React.FC<VerificationPendingProps> = ({ restaurant, onLogout }) => {
  const handleWhatsAppContact = () => {
    const phoneNumber = '+237690160047';
    const message = `Hello! I need assistance with my restaurant account verification. My restaurant name is "${restaurant.name || 'Not provided'}" and my email is "${restaurant.email || 'Not provided'}". Could you please help me with the verification process?`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const getStatusIcon = () => {
    switch (restaurant.verificationStatus) {
      case 'verified':
        return <CheckCircle className="h-12 w-12 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-12 w-12 text-red-500" />;
      default:
        return <Clock className="h-12 w-12 text-yellow-500" />;
    }
  };

  const getStatusMessage = () => {
    switch (restaurant.verificationStatus) {
      case 'verified':
        return {
          title: 'Account Verified!',
          message: 'Your account has been verified and is ready to use.',
          color: 'text-green-600'
        };
      case 'rejected':
        return {
          title: 'Account Verification Rejected',
          message: restaurant.verificationNotes || 'Your account verification was rejected. Please contact support for more information.',
          color: 'text-red-600'
        };
      default:
        return {
          title: 'Account Verification Pending',
          message: 'Your account is under review. You will be notified once verification is complete.',
          color: 'text-yellow-600'
        };
    }
  };

  const statusInfo = getStatusMessage();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {/* Status Icon */}
          <div className="flex justify-center mb-6">
            {getStatusIcon()}
          </div>

          {/* Status Message */}
          <div className="text-center mb-6">
            <h2 className={`text-2xl font-bold ${statusInfo.color} mb-2`}>
              {statusInfo.title}
            </h2>
            <p className="text-gray-600 text-sm">
              {statusInfo.message}
            </p>
          </div>

          {/* Restaurant Information */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Restaurant Information</h3>
            <div className="space-y-2">
              <div className="flex items-center text-sm text-gray-600">
                <span className="font-medium w-20">Name:</span>
                <span>{restaurant.name || 'Not provided'}</span>
              </div>
              {restaurant.email && (
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="h-4 w-4 mr-2" />
                  <span>{restaurant.email}</span>
                </div>
              )}
              {restaurant.phone && (
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="h-4 w-4 mr-2" />
                  <span>{restaurant.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Verification Status Details */}
          {restaurant.verificationStatus === 'pending' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5 mr-3" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">What happens next?</h4>
                  <ul className="mt-2 text-sm text-yellow-700 space-y-1">
                    <li>• Our team will review your account information</li>
                    <li>• You'll receive an email notification once verified</li>
                    <li>• This process typically takes 24-48 hours</li>
                    <li>• You can complete your profile setup in the meantime</li>
                    <li>• Contact us on WhatsApp for faster assistance</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {restaurant.verificationStatus === 'verified' ? (
              <button
                onClick={() => window.location.reload()}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Continue to Dashboard
              </button>
            ) : restaurant.verificationStatus === 'rejected' ? (
              <div className="space-y-2">
                <button
                  onClick={handleWhatsAppContact}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <MessageCircle size={16} className="mr-2" />
                  Contact Support on WhatsApp
                </button>
                <button
                  onClick={onLogout}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={handleWhatsAppContact}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <MessageCircle size={16} className="mr-2" />
                  Contact Support on WhatsApp
                </button>
                <button
                  onClick={onLogout}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>

          {/* Contact Information */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Need help? Contact our support team at{' '}
              <a href="mailto:info@restoflowapp.com" className="text-blue-600 hover:text-blue-500">
                info@restoflowapp.com
              </a>
              {' '}or WhatsApp{' '}
              <a 
                href="https://wa.me/237690160047" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-green-600 hover:text-green-500"
              >
                +237 690 160 047
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerificationPending;
