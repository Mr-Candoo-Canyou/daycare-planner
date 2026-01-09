import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export default function FunderDashboard() {
  const { data: statistics, isLoading: statsLoading } = useQuery({
    queryKey: ['statistics'],
    queryFn: async () => {
      const response = await api.get('/reports/statistics');
      return response.data.statistics;
    }
  });

  const { data: waitlistAnalysis, isLoading: analysisLoading } = useQuery({
    queryKey: ['waitlist-analysis'],
    queryFn: async () => {
      const response = await api.get('/reports/waitlist-analysis');
      return response.data.analysis;
    }
  });

  const { data: parentNetworkRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ['parent-network-requests'],
    queryFn: async () => {
      const response = await api.get('/reports/parent-network-requests');
      return response.data.requests;
    }
  });

  if (statsLoading || analysisLoading || requestsLoading) {
    return <div className="loading">Loading reports...</div>;
  }

  return (
    <div>
      <h2>System-Wide Reports</h2>
      <p style={{ color: 'var(--text-light)', marginBottom: '2rem' }}>
        All data is anonymized to protect privacy. Personal information is only shown for parents
        who have opted into the parent networking program.
      </p>

      {/* Key Statistics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <h4 style={{ color: 'var(--primary-color)', fontSize: '2.5rem', margin: '0.5rem 0' }}>
            {statistics?.totalChildren || 0}
          </h4>
          <p style={{ margin: 0, color: 'var(--text-light)' }}>Total Children</p>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <h4 style={{ color: 'var(--secondary-color)', fontSize: '2.5rem', margin: '0.5rem 0' }}>
            {statistics?.childrenWithPlacements || 0}
          </h4>
          <p style={{ margin: 0, color: 'var(--text-light)' }}>Children with Care</p>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <h4 style={{ color: 'var(--error-color)', fontSize: '2.5rem', margin: '0.5rem 0' }}>
            {statistics?.childrenWithoutCare || 0}
          </h4>
          <p style={{ margin: 0, color: 'var(--text-light)' }}>Children Without Care</p>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <h4 style={{ color: 'var(--warning-color)', fontSize: '2.5rem', margin: '0.5rem 0' }}>
            {statistics?.activeApplications || 0}
          </h4>
          <p style={{ margin: 0, color: 'var(--text-light)' }}>Active Applications</p>
        </div>
      </div>

      {/* Capacity Overview */}
      <div className="card">
        <h3>System Capacity</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem', marginTop: '1rem' }}>
          <div>
            <p style={{ color: 'var(--text-light)', margin: '0 0 0.5rem 0' }}>Total Daycares</p>
            <h4 style={{ margin: 0 }}>{statistics?.totalDaycares || 0}</h4>
          </div>
          <div>
            <p style={{ color: 'var(--text-light)', margin: '0 0 0.5rem 0' }}>Total Capacity</p>
            <h4 style={{ margin: 0 }}>{statistics?.capacity?.total || 0} spots</h4>
          </div>
          <div>
            <p style={{ color: 'var(--text-light)', margin: '0 0 0.5rem 0' }}>Available Spots</p>
            <h4 style={{ margin: 0, color: statistics?.capacity?.available > 0 ? 'var(--secondary-color)' : 'var(--error-color)' }}>
              {statistics?.capacity?.available || 0} spots
            </h4>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', background: 'var(--bg-secondary)', height: '40px', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${(statistics?.capacity?.enrolled / statistics?.capacity?.total * 100) || 0}%`,
            background: 'var(--primary-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold'
          }}>
            {Math.round((statistics?.capacity?.enrolled / statistics?.capacity?.total * 100) || 0)}% Full
          </div>
        </div>
      </div>

      {/* Subsidy Information */}
      <div className="card">
        <h3>Subsidy Program</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div>
            <p style={{ color: 'var(--text-light)', margin: '0 0 0.5rem 0' }}>Subsidized Placements</p>
            <h4 style={{ margin: 0 }}>{statistics?.subsidies?.count || 0}</h4>
          </div>
          <div>
            <p style={{ color: 'var(--text-light)', margin: '0 0 0.5rem 0' }}>Total Subsidy Amount</p>
            <h4 style={{ margin: 0 }}>
              ${statistics?.subsidies?.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
            </h4>
          </div>
        </div>
      </div>

      {/* Age Distribution */}
      <div className="card">
        <h3>Age Distribution (Anonymized)</h3>
        <table>
          <thead>
            <tr>
              <th>Age Group</th>
              <th>Number of Children</th>
            </tr>
          </thead>
          <tbody>
            {statistics?.ageDistribution?.map((group: any) => (
              <tr key={group.age_group}>
                <td>{group.age_group}</td>
                <td>{group.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Regional Waitlist Analysis */}
      <div className="card">
        <h3>Regional Waitlist Analysis</h3>
        <table>
          <thead>
            <tr>
              <th>Region</th>
              <th>Total Waitlisted</th>
              <th>Without Current Care</th>
              <th>Avg Capacity</th>
              <th>Avg Enrollment</th>
            </tr>
          </thead>
          <tbody>
            {waitlistAnalysis?.map((region: any) => (
              <tr key={`${region.city}-${region.province}`}>
                <td>{region.city}, {region.province}</td>
                <td>{region.total_waitlisted}</td>
                <td>
                  <span style={{ color: 'var(--error-color)', fontWeight: 'bold' }}>
                    {region.without_current_care}
                  </span>
                </td>
                <td>{Math.round(region.avg_capacity)}</td>
                <td>{Math.round(region.avg_enrollment)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Parent Networking Requests */}
      <div className="card">
        <h3>Parent Networking Requests</h3>
        <p style={{ color: 'var(--text-light)', marginBottom: '1rem' }}>
          Parents who have opted-in to be connected with others to start their own childcare organizations.
        </p>

        {parentNetworkRequests && parentNetworkRequests.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Parent Name</th>
                <th>Contact Email</th>
                <th>Desired Area</th>
                <th>Number of Children</th>
                <th>Request Date</th>
              </tr>
            </thead>
            <tbody>
              {parentNetworkRequests.map((request: any) => (
                <tr key={request.id}>
                  <td>{request.first_name} {request.last_name}</td>
                  <td>
                    <a href={`mailto:${request.contact_email}`} style={{ color: 'var(--primary-color)' }}>
                      {request.contact_email}
                    </a>
                  </td>
                  <td>{request.desired_area || 'Not specified'}</td>
                  <td>{request.number_of_children}</td>
                  <td>{new Date(request.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: '2rem' }}>
            No parent networking requests at this time.
          </p>
        )}
      </div>
    </div>
  );
}
