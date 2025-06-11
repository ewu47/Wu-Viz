import { useState } from 'react';
import './App.css'
import './styles/responsive.css';
import Banner from './components/Banner'
import About from './components/About'
import Projects from './components/Projects'
import DivvyProject from './components/DivvyProject'

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'divvy'>('home');
  const [isAnimating, setIsAnimating] = useState(false);

  const handleProjectClick = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentPage('divvy');
      setIsAnimating(false);
    }, 600);
  };

  const handleBackToHome = () => {
    setCurrentPage('home');
  };

  return (
    <div className="App">
      <div className="main-content responsive-container">
        <div className={`app ${isAnimating ? 'animating' : ''}`}>
          <Banner isAnimating={isAnimating} currentPage={currentPage} onBackToHome={handleBackToHome} />
          {currentPage === 'home' ? (
            <>
              <About />
              <Projects onProjectClick={handleProjectClick} />
            </>
          ) : (
            <DivvyProject />
          )}
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
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
        minHeight: '40px'
      }}>
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
        >
          E.WU
        </button>
      </footer>
    </div>
  )
}

export default App
