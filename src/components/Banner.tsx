import { ArrowLeft } from 'lucide-react'

interface BannerProps {
  currentPage: 'home' | 'divvy'
  onBackToHome: () => void
}

export default function Banner({ currentPage, onBackToHome }: BannerProps) {
  return (
    <>
      <nav className="site-nav">
        <div className="site-nav-inner">
          <button className="site-logo" onClick={onBackToHome} type="button" title="Return home">
            Wu<span>Viz</span>
          </button>
          {currentPage === 'divvy' ? (
            <button className="site-back" type="button" onClick={onBackToHome}>
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              All projects
            </button>
          ) : (
            <span className="site-nav-label">Data journal · Chicago</span>
          )}
        </div>
      </nav>

      {currentPage === 'home' && (
        <header className="home-hero">
          <div className="home-hero-inner">
            <p className="home-kicker">Statistics · Visualization · Curiosity</p>
            <h1>
              Data is more useful
              <span>when it reads like a story.</span>
            </h1>
            <p className="home-lede">
              WuViz is Eddie Wu’s working journal of analytical projects—built to make
              large datasets legible, interactive, and a little more human.
            </p>
          </div>
        </header>
      )}
    </>
  )
}
