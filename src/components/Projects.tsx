import { ArrowUpRight, Bike } from 'lucide-react'

interface ProjectsProps {
  onProjectClick: () => void;
}

const Projects = ({ onProjectClick }: ProjectsProps) => {
  return (
    <section className="projects-section">
      <div className="section-header">
        <p>Featured work</p>
        <h2>One neighborhood, thirteen years of movement.</h2>
      </div>

      <article className="project-card" onClick={onProjectClick} role="button" tabIndex={0}
        aria-label="Open Divvy around UChicago mobility atlas"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onProjectClick()
          }
        }}>
        <div className="project-card-icon"><Bike aria-hidden="true" /></div>
        <div className="project-card-body">
          <div className="project-card-meta">
            <span className="project-tag">Mobility atlas</span>
            <span className="project-year">2013—2026</span>
          </div>
          <h3>Divvy around UChicago</h3>
          <p className="project-card-desc">
            A cleaned, interactive history of 1.2 million bike-share trips across
            UChicago and Hyde Park.
          </p>
          <span className="project-card-link">
            Open the atlas
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </span>
        </div>
      </article>
    </section>
  )
}

export default Projects
