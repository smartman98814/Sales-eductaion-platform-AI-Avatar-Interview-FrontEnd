/**
 * Landing Page Component
 * Floral Image company brand page
 */
import { AVATARS } from '../data/avatarData';
import '../styles/landing.css';

export function LandingPage() {
  // Get Patricia, Rick, and Sofia avatars
  const patricia = AVATARS.find(a => a.name === 'Patricia');
  const rick = AVATARS.find(a => a.name === 'Rick');
  const sofia = AVATARS.find(a => a.name === 'Sofia');

  return (
    <div className="landing-page">
      <div className="landing-hero">
        <div className="landing-container">
          <div className="landing-content">
            <h1 className="landing-title">Floral Image</h1>
            <h2 className="landing-subtitle">Sustainable, Lifelike Floral Arrangements for Your Business</h2>
            <p className="landing-description">
              Transform your space with our handmade, sustainable flower arrangements. 
              Experience the beauty of fresh flowers without the mess, allergies, or high costs. 
              Join over 45,000 businesses worldwide who trust Floral Image.
            </p>
            
            <div className="landing-features">
              <div className="feature-card">
                <div className="feature-icon">
                  {patricia && (
                    <img 
                      src={patricia.imageUrl} 
                      alt={patricia.fullName}
                      className="feature-avatar-image"
                    />
                  )}
                </div>
                <h3>Sustainable</h3>
                <p>80 times more sustainable than fresh cut flowers over a 5-year period</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">
                  {rick && (
                    <img 
                      src={rick.imageUrl} 
                      alt={rick.fullName}
                      className="feature-avatar-image"
                    />
                  )}
                </div>
                <h3>Monthly Refresh</h3>
                <p>New arrangements delivered monthly - always fresh, always beautiful</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">
                  {sofia && (
                    <img 
                      src={sofia.imageUrl} 
                      alt={sofia.fullName}
                      className="feature-avatar-image"
                    />
                  )}
                </div>
                <h3>No Contracts</h3>
                <p>Flexible month-to-month service - cancel anytime, no commitments</p>
              </div>
            </div>

            <div className="landing-benefits">
              <div className="benefit-item">
                <span className="benefit-icon">🌿</span>
                <span className="benefit-text">No allergies, no mess, no water</span>
              </div>
              <div className="benefit-item">
                <span className="benefit-icon">💰</span>
                <span className="benefit-text">Significant cost savings vs. fresh flowers</span>
              </div>
              <div className="benefit-item">
                <span className="benefit-icon">💬</span>
                <span className="benefit-text">Creates positive conversations with clients</span>
              </div>
              <div className="benefit-item">
                <span className="benefit-icon">🔄</span>
                <span className="benefit-text">Monthly refresh service included</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="landing-footer">
        <div className="landing-container">
          <p>&copy; 2024 Floral Image. All rights reserved.</p>
          <p className="footer-tagline">Handmade • Sustainable • Lifelike</p>
        </div>
      </div>
    </div>
  );
}

