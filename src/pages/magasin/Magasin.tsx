import { Navigate } from 'react-router-dom';

// This component redirects to the default matieres page
// Navigation is now handled by the sidebar submenu
const Magasin = () => {
  return <Navigate to="matieres" replace />;
};

export default Magasin;

