// Centralized design system settings
const designSystem = {
  colors: {
    primary: '#111111',         // Deep black
    secondary: '#FFD700',       // Gold
    background: '#111111',      // Main background (deep black)
    accent: '#FFD700',          // Gold accent
    text: '#111111',            // Black text (for light backgrounds)
    textInverse: '#FFFFFF',     // White text (for dark backgrounds)
    sidebarBackground: '#111111', // Sidebar background (deep black)
    sidebarNavHover: '#18181A',   // Sidebar nav item hover background
    border: '#1F2937',          // border for dark bg
    borderLightGray: '#E5E5E5',  // Light border for white bg
    white: '#FFFFFF',           // White
    black: '#000000',           // Black
    backgroundLight: '#F3F4F6', // Light gray for inactive/hover backgrounds
    // Status colors for orders
    statusPendingBg: '#FEF3C7',      // yellow-200
    statusPendingText: '#B45309',    // yellow-800
    statusPreparingBg: '#DBEAFE',    // blue-200
    statusPreparingText: '#1E40AF',  // blue-800
    statusReadyBg: '#BBF7D0',        // green-200
    statusReadyText: '#166534',      // green-800
    statusCompletedBg: '#E5E7EB',    // gray-200
    statusCompletedText: '#374151',  // gray-800
    statusCancelledBg: '#FECACA',    // red-200
    statusCancelledText: '#991B1B',  // red-800
    statusDefaultBg: '#F3F4F6',      // gray-100
    statusDefaultText: '#4B5563',    // gray-600

    iconFiltercolor: '#9CA3AF',
    highlightYellow: '#FFE600', // For the 'All' tab background (from screenshot)
    iconGray: '#B0B4BA', // For icons and muted text (from screenshot)
    subtitleGray: '#6B7280', // For subtitle text (address, phone, etc.)
    starYellow: '#FFD600', // For the star icon (rating)
    timeGray: '#7C7C7C', // For delivery time text

    // Modal and input colors for consistent UI polish
    modalOverlay: 'rgba(30, 41, 59, 0.65)', // dark overlay for modals
    inputBorder: '#E5E5E5', // matches borderLightGray
    inputBg: '#FFFFFF', // white input background

    // Toast/notification colors
    success: '#22C55E', // green-500
    error: '#EF4444',   // red-500

    // Google brand colors for social login button
    googleBlue: '#4285F4',   // Google Blue
    googleGreen: '#34A853',  // Google Green
    googleYellow: '#FBBC05', // Google Yellow
    googleRed: '#EA4335',    // Google Red
  },
  fonts: {
    body: 'Inter, sans-serif',
    heading: 'Poppins, sans-serif',
    bold: 'Poppins-Bold, Poppins, sans-serif', // For extra bold headers
    regular: 'Poppins-Regular, Poppins, sans-serif', // For regular text
  },
};

export default designSystem;
