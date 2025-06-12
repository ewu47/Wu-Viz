import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import './App.css'
import './styles/responsive.css';
import Banner from './components/Banner'
import About from './components/About'
import Projects from './components/Projects'
import DivvyProject from './components/DivvyProject'

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPage = location.pathname === '/divvy' ? 'divvy' : 'home';

  useEffect(() => {
    // Add cache-busting meta tags
    const addCacheBustingMeta = () => {
      // Remove existing cache-busting meta tags
      const existingMetas = document.querySelectorAll('meta[http-equiv="Cache-Control"], meta[http-equiv="Pragma"], meta[http-equiv="Expires"]');
      existingMetas.forEach(meta => meta.remove());
      
      // Add new cache-busting meta tags
      const cacheControlMeta = document.createElement('meta');
      cacheControlMeta.setAttribute('http-equiv', 'Cache-Control');
      cacheControlMeta.setAttribute('content', 'no-cache, no-store, must-revalidate');
      document.head.appendChild(cacheControlMeta);
      
      const pragmaMeta = document.createElement('meta');
      pragmaMeta.setAttribute('http-equiv', 'Pragma');
      pragmaMeta.setAttribute('content', 'no-cache');
      document.head.appendChild(pragmaMeta);
      
      const expiresMeta = document.createElement('meta');
      expiresMeta.setAttribute('http-equiv', 'Expires');
      expiresMeta.setAttribute('content', '0');
      document.head.appendChild(expiresMeta);
    };
    
    addCacheBustingMeta();
    
    // Check for stored redirect from 404 page
    const storedRedirect = sessionStorage.getItem('redirect');
    if (storedRedirect) {
      sessionStorage.removeItem('redirect');
      navigate(storedRedirect);
    }
  }, [navigate]);

  useEffect(() => {
    if (currentPage === 'divvy') {
      document.title = 'UChicago Divvy Stats 2024-2025';
    } else {
      document.title = 'Wu Viz';
    }
  }, [currentPage]);

  const handleProjectClick = () => {
    navigate('/divvy');
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  return (
    <div className="App">
      <div className="main-content responsive-container">
        <div className="app">
          <Banner currentPage={currentPage} onBackToHome={handleBackToHome} />
          <Routes>
            <Route path="/" element={
              <>
                <About />
                <Projects onProjectClick={handleProjectClick} />
              </>
            } />
            <Route path="/divvy" element={<DivvyProject />} />
          </Routes>
        </div>
      </div>
      
      {/* Fixed Footer */}
      <footer style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        left: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(128, 0, 0, 0.1)',
        padding: '8px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 1000,
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
        minHeight: '40px'
      }}>
        <span style={{
          fontSize: '12px',
          color: '#666',
          fontStyle: 'italic'
        }}>
          {currentPage === 'divvy' ? 'Click E.WU to return home' : ''}
        </span>
        
        <button
          onClick={handleBackToHome}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#800000',
            fontSize: '20px',
            fontWeight: '800',
            letterSpacing: '1px',
            cursor: 'pointer',
            padding: '4px 12px',
            borderRadius: '6px',
            transition: 'all 0.3s ease',
            textShadow: '1px 1px 2px rgba(0,0,0,0.1)'
          }}
          onMouseOver={(e) => {
            const target = e.target as HTMLElement;
            target.style.backgroundColor = 'rgba(128, 0, 0, 0.1)';
            target.style.transform = 'scale(1.05)';
          }}
          onMouseOut={(e) => {
            const target = e.target as HTMLElement;
            target.style.backgroundColor = 'transparent';
            target.style.transform = 'scale(1)';
          }}
          title="Return to home page"
        >
          E.WU
        </button>
        
        <div style={{ width: '120px' }}></div> 
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router basename="/Wu-Viz">
      <AppContent />
    </Router>
  );
}

export default App
