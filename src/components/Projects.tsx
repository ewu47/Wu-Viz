import React from 'react';

interface ProjectsProps {
  onProjectClick: () => void;
}

const Projects: React.FC<ProjectsProps> = ({ onProjectClick }) => {
  return (
    <section className="projects-section">
      <h2>Projects</h2>
      <div className="paper-entry">
        <h3 className="paper-title">
          Divvy @ University of Chicago 2024 - 2025
        </h3>
        <div className="paper-content">
          <p className="paper-authors">Eddie Wu</p>
          <p className="paper-venue">2025</p>
          <p className="paper-abstract">
            Analysis of areas around UChicago and Hyde Park's Divvy bike-sharing system. 
            Examine the cool trends and stats! 
          </p>
          <button className="paper-link" onClick={onProjectClick}>
            View Project →
          </button>
        </div>
      </div>
    </section>
  );
};

export default Projects;
