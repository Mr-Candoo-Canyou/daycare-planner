import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { format } from 'date-fns';

export default function ParentDashboard() {
  const { data: applications, isLoading: appsLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: async () => {
      const response = await api.get('/applications/my-applications');
      return response.data.applications;
    }
  });

  const { data: children, isLoading: childrenLoading } = useQuery({
    queryKey: ['children'],
    queryFn: async () => {
      const response = await api.get('/children');
      return response.data.children;
    }
  });

  const getStatusBadge = (status: string) => {
    return <span className={`badge badge-${status}`}>{status}</span>;
  };

  if (appsLoading || childrenLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Parent Dashboard</h2>
        <Link to="/parent/apply">
          <button className="btn-primary">New Application</button>
        </Link>
      </div>

      <div className="card">
        <h3>My Children</h3>
        {children && children.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Date of Birth</th>
                <th>Age</th>
              </tr>
            </thead>
            <tbody>
              {children.map((child: any) => (
                <tr key={child.id}>
                  <td>{child.first_name} {child.last_name}</td>
                  <td>{format(new Date(child.date_of_birth), 'MMM d, yyyy')}</td>
                  <td>
                    {Math.floor((Date.now() - new Date(child.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} years
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: 'var(--text-light)' }}>No children registered yet.</p>
        )}
      </div>

      <div className="card">
        <h3>My Applications</h3>
        {applications && applications.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {applications.map((app: any) => (
              <div key={app.id} className="card" style={{ background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <h4 style={{ margin: 0 }}>
                      {app.first_name} {app.last_name}
                    </h4>
                    <p style={{ margin: '0.25rem 0', color: 'var(--text-light)', fontSize: '0.875rem' }}>
                      Applied: {format(new Date(app.application_date), 'MMM d, yyyy')}
                    </p>
                    <p style={{ margin: 0, color: 'var(--text-light)', fontSize: '0.875rem' }}>
                      Desired start: {format(new Date(app.desired_start_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>

                <h5 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>Daycare Preferences:</h5>
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Daycare</th>
                      <th>Status</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {app.choices.map((choice: any) => (
                      <tr key={choice.daycareId}>
                        <td>#{choice.preferenceRank}</td>
                        <td>{choice.daycareName}</td>
                        <td>{getStatusBadge(choice.status)}</td>
                        <td>
                          {choice.statusUpdatedAt
                            ? format(new Date(choice.statusUpdatedAt), 'MMM d, yyyy')
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-light)', marginBottom: '1rem' }}>
              No applications yet. Start by applying to daycares.
            </p>
            <Link to="/parent/apply">
              <button className="btn-primary">Create Application</button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
