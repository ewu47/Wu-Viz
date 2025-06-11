import React from 'react';

interface BannerProps {
  currentPage: 'home' | 'divvy';
  onBackToHome: () => void;
}

const Banner: React.FC<BannerProps> = ({ currentPage }) => {
  return (
    <header className={`banner ${currentPage === 'divvy' ? 'banner-project' : ''}`}>
      <div className="banner-content" style={{ textAlign: 'center' }}>
        <h1 className="banner-title">
          {currentPage === 'home' ? 'Data Visualizations' : 'Divvy @ UChicago'}
        </h1>
      </div>
    </header>
  );
};

export default Banner;
