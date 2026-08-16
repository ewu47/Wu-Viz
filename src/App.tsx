import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter as Router, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import './App.css'
import About from './components/About'
import Banner from './components/Banner'
import Projects from './components/Projects'

const DivvyProject = lazy(() => import('./components/DivvyProject'))

function AppContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentPage = location.pathname === '/divvy' ? 'divvy' : 'home'

  useEffect(() => {
    document.title = currentPage === 'divvy'
      ? 'Hyde Park Mobility Atlas · WuViz'
      : 'WuViz · Data stories by Eddie Wu'
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [currentPage])

  return (
    <div className="App">
      <Banner currentPage={currentPage} onBackToHome={() => navigate('/')} />
      <Routes>
        <Route
          path="/"
          element={(
            <>
              <About />
              <Projects onProjectClick={() => navigate('/divvy')} />
            </>
          )}
        />
        <Route
          path="/divvy"
          element={(
            <Suspense fallback={<div className="atlas-shell min-h-[65vh] py-24 font-mono text-sm text-muted-foreground">Loading the atlas…</div>}>
              <DivvyProject />
            </Suspense>
          )}
        />
      </Routes>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <span>WuViz · Chicago</span>
          <button type="button" onClick={() => navigate('/')} title="Return home">
            E.WU
          </button>
          <span>{currentPage === 'divvy' ? 'Official Divvy data · 2013–2026' : 'Statistics as a personal journal'}</span>
        </div>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <Router basename="/Wu-Viz">
      <AppContent />
    </Router>
  )
}
