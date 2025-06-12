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
