import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

// --- PAGES ---
import Dashboard from './pages/Dashboard';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

// --- UX: AUTO-SCROLL TO TOP ---
// Ensures that when a user clicks a link, the new page starts at the top.
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto'
    });
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        {/* Sential Engine is now the absolute core of the app */}
        <Route path="/" element={<Dashboard />} />
        
        {/* Retaining legal/docs for open-source compliance if needed */}
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        
        {/* CATCH-ALL ROUTE: Any broken links redirect straight to the Engine */}
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}