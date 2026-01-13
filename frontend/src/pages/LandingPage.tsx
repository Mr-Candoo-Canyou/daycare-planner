import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      {/* Header */}
      <header style={{
        padding: '1rem 0',
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)'
      }}>
        <div className="container" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h1 style={{ margin: 0, color: 'white', fontSize: '1.75rem' }}>
            Daycare Planner
          </h1>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link to="/login">
              <button style={{
                background: 'transparent',
                border: '2px solid white',
                color: 'white',
                padding: '0.5rem 1.5rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 500
              }}>
                Login
              </button>
            </Link>
            <Link to="/register">
              <button style={{
                background: 'white',
                border: 'none',
                color: '#667eea',
                padding: '0.5rem 1.5rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 500
              }}>
                Get Started
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ padding: '4rem 0', textAlign: 'center', color: 'white' }}>
        <div className="container">
          <h2 style={{
            fontSize: '3rem',
            margin: '0 0 1rem 0',
            fontWeight: 700
          }}>
            Simplify Daycare Access for Everyone
          </h2>
          <p style={{
            fontSize: '1.25rem',
            maxWidth: '700px',
            margin: '0 auto 2rem auto',
            opacity: 0.95
          }}>
            A privacy-focused platform that helps parents find childcare, supports daycares
            in managing waitlists, and empowers communities to create new childcare solutions.
          </p>
          <Link to="/register">
            <button className="btn-primary" style={{
              padding: '1rem 2rem',
              fontSize: '1.125rem',
              background: 'white',
              color: '#667eea'
            }}>
              Apply to Daycares Today
            </button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section style={{ padding: '4rem 0', background: 'white' }}>
        <div className="container">
          <h3 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '3rem' }}>
            How It Works
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem',
            marginBottom: '3rem'
          }}>
            {/* For Parents */}
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{
                width: '60px',
                height: '60px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '50%',
                margin: '0 auto 1rem auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '1.5rem',
                fontWeight: 'bold'
              }}>
                1
              </div>
              <h4 style={{ color: '#667eea' }}>For Parents</h4>
              <p style={{ color: 'var(--text-light)' }}>
                Apply to multiple daycares with one simple ranked-choice form.
                Track your application status and get matched with other parents
                if no placement is available.
              </p>
              <ul style={{
                textAlign: 'left',
                margin: '1rem 0',
                paddingLeft: '1.5rem',
                color: 'var(--text-light)'
              }}>
                <li>One application for all your preferred daycares</li>
                <li>Real-time status updates</li>
                <li>Connect with other parents (opt-in)</li>
                <li>Privacy-first design</li>
              </ul>
            </div>

            {/* For Daycares */}
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{
                width: '60px',
                height: '60px',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                borderRadius: '50%',
                margin: '0 auto 1rem auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '1.5rem',
                fontWeight: 'bold'
              }}>
                2
              </div>
              <h4 style={{ color: '#f5576c' }}>For Daycares</h4>
              <p style={{ color: 'var(--text-light)' }}>
                Manage your waitlist efficiently. See which children already have care
                and which families need it most urgently. Full control over admissions.
              </p>
              <ul style={{
                textAlign: 'left',
                margin: '1rem 0',
                paddingLeft: '1.5rem',
                color: 'var(--text-light)'
              }}>
                <li>Complete waitlist visibility</li>
                <li>See placement status of applicants</li>
                <li>Prioritize based on your rules</li>
                <li>Streamlined application review</li>
              </ul>
            </div>

            {/* For Funders */}
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{
                width: '60px',
                height: '60px',
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                borderRadius: '50%',
                margin: '0 auto 1rem auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '1.5rem',
                fontWeight: 'bold'
              }}>
                3
              </div>
              <h4 style={{ color: '#00f2fe' }}>For Funders</h4>
              <p style={{ color: 'var(--text-light)' }}>
                Access system-wide insights with anonymized data. Track subsidy
                effectiveness and connect with parents interested in starting
                new childcare organizations.
              </p>
              <ul style={{
                textAlign: 'left',
                margin: '1rem 0',
                paddingLeft: '1.5rem',
                color: 'var(--text-light)'
              }}>
                <li>Anonymized reporting dashboards</li>
                <li>Regional capacity analysis</li>
                <li>Subsidy program tracking</li>
                <li>Parent networking requests</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy Section */}
      <section style={{ padding: '4rem 0', background: '#f9fafb' }}>
        <div className="container">
          <h3 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '2rem' }}>
            Privacy-First Design
          </h3>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '2rem'
            }}>
              <div>
                <h4 style={{ color: '#667eea', marginBottom: '0.5rem' }}>
                  🔒 Your Data, Your Control
                </h4>
                <p style={{ color: 'var(--text-light)' }}>
                  You decide what information to share. Opt-in features mean
                  nothing is shared without your explicit consent.
                </p>
              </div>
              <div>
                <h4 style={{ color: '#667eea', marginBottom: '0.5rem' }}>
                  🛡️ Minimal Data Collection
                </h4>
                <p style={{ color: 'var(--text-light)' }}>
                  We only collect what's necessary for matching families with
                  childcare. No tracking, no advertising, no third-party sharing.
                </p>
              </div>
              <div>
                <h4 style={{ color: '#667eea', marginBottom: '0.5rem' }}>
                  📊 Anonymized Reporting
                </h4>
                <p style={{ color: 'var(--text-light)' }}>
                  Funders see trends and statistics, never personal information.
                  All reports are fully anonymized.
                </p>
              </div>
              <div>
                <h4 style={{ color: '#667eea', marginBottom: '0.5rem' }}>
                  📝 Complete Audit Trail
                </h4>
                <p style={{ color: 'var(--text-light)' }}>
                  Every action is logged for transparency and accountability.
                  You can always see who accessed what.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        padding: '4rem 0',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        textAlign: 'center'
      }}>
        <div className="container">
          <h3 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
            Ready to Get Started?
          </h3>
          <p style={{ fontSize: '1.125rem', marginBottom: '2rem', opacity: 0.95 }}>
            Join parents, daycares, and funders working together to improve childcare access.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/register">
              <button style={{
                background: 'white',
                border: 'none',
                color: '#667eea',
                padding: '1rem 2rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '1.125rem'
              }}>
                Create Free Account
              </button>
            </Link>
            <Link to="/login">
              <button style={{
                background: 'transparent',
                border: '2px solid white',
                color: 'white',
                padding: '1rem 2rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '1.125rem'
              }}>
                Sign In
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '2rem 0',
        background: 'rgba(0, 0, 0, 0.2)',
        color: 'white',
        textAlign: 'center'
      }}>
        <div className="container">
          <p style={{ margin: 0, opacity: 0.9 }}>
            Privacy-focused daycare waitlist management system
          </p>
          <p style={{ margin: '0.5rem 0 0 0', opacity: 0.7, fontSize: '0.875rem' }}>
            Open source • Community-driven • Privacy-first
          </p>
        </div>
      </footer>
    </div>
  );
}
