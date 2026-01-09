import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'daycares' | 'applications' | 'logs'>('overview');
  const [daycareForm, setDaycareForm] = useState({
    name: '',
    address: '',
    city: '',
    province: '',
    postalCode: '',
    phone: '',
    email: '',
    capacity: '',
    ageRangeMin: '',
    ageRangeMax: '',
    languages: '',
    hasSubsidyProgram: false,
    description: ''
  });
  const [daycareError, setDaycareError] = useState('');
  const [daycareSuccess, setDaycareSuccess] = useState('');

  const { data: statistics } = useQuery({
    queryKey: ['admin-statistics'],
    queryFn: async () => {
      const response = await api.get('/admin/statistics');
      return response.data.statistics;
    }
  });

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const response = await api.get('/admin/users');
      return response.data.users;
    },
    enabled: activeTab === 'users'
  });

  const { data: daycares } = useQuery({
    queryKey: ['admin-daycares'],
    queryFn: async () => {
      const response = await api.get('/admin/daycares');
      return response.data.daycares;
    },
    enabled: activeTab === 'daycares'
  });

  const { data: applications } = useQuery({
    queryKey: ['admin-applications'],
    queryFn: async () => {
      const response = await api.get('/admin/applications');
      return response.data.applications;
    },
    enabled: activeTab === 'applications'
  });

  const { data: logs } = useQuery({
    queryKey: ['admin-logs'],
    queryFn: async () => {
      const response = await api.get('/admin/audit-logs');
      return response.data.logs;
    },
    enabled: activeTab === 'logs'
  });

  const updateUserStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      await api.patch(`/admin/users/${userId}/status`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    }
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await api.patch(`/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    }
  });

  const createDaycareMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: daycareForm.name.trim(),
        address: daycareForm.address.trim(),
        city: daycareForm.city.trim(),
        province: daycareForm.province.trim(),
        postalCode: daycareForm.postalCode.trim(),
        phone: daycareForm.phone.trim(),
        email: daycareForm.email.trim(),
        capacity: parseInt(daycareForm.capacity, 10),
        ageRangeMin: daycareForm.ageRangeMin ? parseInt(daycareForm.ageRangeMin, 10) : undefined,
        ageRangeMax: daycareForm.ageRangeMax ? parseInt(daycareForm.ageRangeMax, 10) : undefined,
        languages: daycareForm.languages
          .split(',')
          .map((lang) => lang.trim())
          .filter(Boolean),
        hasSubsidyProgram: daycareForm.hasSubsidyProgram,
        description: daycareForm.description.trim()
      };

      await api.post('/daycares', payload);
    },
    onSuccess: () => {
      setDaycareSuccess('Daycare created.');
      setDaycareError('');
      setDaycareForm({
        name: '',
        address: '',
        city: '',
        province: '',
        postalCode: '',
        phone: '',
        email: '',
        capacity: '',
        ageRangeMin: '',
        ageRangeMax: '',
        languages: '',
        hasSubsidyProgram: false,
        description: ''
      });
      queryClient.invalidateQueries({ queryKey: ['admin-daycares'] });
      queryClient.invalidateQueries({ queryKey: ['admin-statistics'] });
    },
    onError: (error: any) => {
      setDaycareSuccess('');
      setDaycareError(error?.response?.data?.error || 'Failed to create daycare.');
    }
  });

  const renderOverview = () => (
    <div>
      <h3>System Overview</h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <h4 style={{ color: 'var(--primary-color)', fontSize: '2rem', margin: '0.5rem 0' }}>
            {statistics?.users?.total || 0}
          </h4>
          <p style={{ margin: 0, color: 'var(--text-light)' }}>Total Users</p>
          <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
            <div>Parents: {statistics?.users?.parents || 0}</div>
            <div>Daycare Admins: {statistics?.users?.daycare_admins || 0}</div>
            <div>Funders: {statistics?.users?.funders || 0}</div>
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <h4 style={{ color: 'var(--secondary-color)', fontSize: '2rem', margin: '0.5rem 0' }}>
            {statistics?.daycares?.total || 0}
          </h4>
          <p style={{ margin: 0, color: 'var(--text-light)' }}>Total Daycares</p>
          <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
            <div>Capacity: {statistics?.daycares?.total_capacity || 0}</div>
            <div>Enrolled: {statistics?.daycares?.total_enrollment || 0}</div>
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <h4 style={{ color: 'var(--warning-color)', fontSize: '2rem', margin: '0.5rem 0' }}>
            {statistics?.applications?.total || 0}
          </h4>
          <p style={{ margin: 0, color: 'var(--text-light)' }}>Total Applications</p>
          <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
            <div>Pending: {statistics?.applications?.pending || 0}</div>
            <div>Waitlisted: {statistics?.applications?.waitlisted || 0}</div>
            <div>Accepted: {statistics?.applications?.accepted || 0}</div>
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <h4 style={{ color: 'var(--primary-color)', fontSize: '2rem', margin: '0.5rem 0' }}>
            {statistics?.placements?.total || 0}
          </h4>
          <p style={{ margin: 0, color: 'var(--text-light)' }}>Active Placements</p>
          <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
            <div>Subsidized: {statistics?.placements?.subsidized || 0}</div>
            <div>Subsidy Total: ${parseFloat(statistics?.placements?.subsidy_total || '0').toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div>
      <h3>User Management</h3>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Joined</th>
            <th>Last Login</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users?.map((user: any) => (
            <tr key={user.id}>
              <td>{user.first_name} {user.last_name}</td>
              <td>{user.email}</td>
              <td>
                <select
                  value={user.role}
                  onChange={(e) => updateUserRoleMutation.mutate({ userId: user.id, role: e.target.value })}
                  style={{ padding: '0.25rem' }}
                >
                  <option value="parent">Parent</option>
                  <option value="daycare_admin">Daycare Admin</option>
                  <option value="funder">Funder</option>
                  <option value="system_admin">System Admin</option>
                </select>
              </td>
              <td>
                <span className={`badge ${user.is_active ? 'badge-accepted' : 'badge-rejected'}`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>{new Date(user.created_at).toLocaleDateString()}</td>
              <td>{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
              <td>
                <button
                  onClick={() => updateUserStatusMutation.mutate({ userId: user.id, isActive: !user.is_active })}
                  className={user.is_active ? 'btn-danger' : 'btn-secondary'}
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                >
                  {user.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderDaycares = () => (
    <div>
      <h3>Daycare Management</h3>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ marginTop: 0 }}>Create Daycare</h4>
        {daycareError && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            {daycareError}
          </div>
        )}
        {daycareSuccess && (
          <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
            {daycareSuccess}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setDaycareError('');
            setDaycareSuccess('');
            createDaycareMutation.mutate();
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="daycare-name">Name</label>
              <input
                id="daycare-name"
                value={daycareForm.name}
                onChange={(e) => setDaycareForm({ ...daycareForm, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="daycare-email">Email</label>
              <input
                id="daycare-email"
                type="email"
                value={daycareForm.email}
                onChange={(e) => setDaycareForm({ ...daycareForm, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="daycare-phone">Phone</label>
              <input
                id="daycare-phone"
                value={daycareForm.phone}
                onChange={(e) => setDaycareForm({ ...daycareForm, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="daycare-capacity">Capacity</label>
              <input
                id="daycare-capacity"
                type="number"
                min="1"
                value={daycareForm.capacity}
                onChange={(e) => setDaycareForm({ ...daycareForm, capacity: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="daycare-address">Address</label>
              <input
                id="daycare-address"
                value={daycareForm.address}
                onChange={(e) => setDaycareForm({ ...daycareForm, address: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="daycare-city">City</label>
              <input
                id="daycare-city"
                value={daycareForm.city}
                onChange={(e) => setDaycareForm({ ...daycareForm, city: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="daycare-province">Province</label>
              <input
                id="daycare-province"
                value={daycareForm.province}
                onChange={(e) => setDaycareForm({ ...daycareForm, province: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="daycare-postal">Postal Code</label>
              <input
                id="daycare-postal"
                value={daycareForm.postalCode}
                onChange={(e) => setDaycareForm({ ...daycareForm, postalCode: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="daycare-age-min">Age Range Min</label>
              <input
                id="daycare-age-min"
                type="number"
                min="0"
                value={daycareForm.ageRangeMin}
                onChange={(e) => setDaycareForm({ ...daycareForm, ageRangeMin: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="daycare-age-max">Age Range Max</label>
              <input
                id="daycare-age-max"
                type="number"
                min="0"
                value={daycareForm.ageRangeMax}
                onChange={(e) => setDaycareForm({ ...daycareForm, ageRangeMax: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="daycare-languages">Languages (comma-separated)</label>
              <input
                id="daycare-languages"
                value={daycareForm.languages}
                onChange={(e) => setDaycareForm({ ...daycareForm, languages: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                id="daycare-subsidy"
                type="checkbox"
                checked={daycareForm.hasSubsidyProgram}
                onChange={(e) => setDaycareForm({ ...daycareForm, hasSubsidyProgram: e.target.checked })}
              />
              <label htmlFor="daycare-subsidy">Has Subsidy Program</label>
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label htmlFor="daycare-description">Description</label>
            <textarea
              id="daycare-description"
              value={daycareForm.description}
              onChange={(e) => setDaycareForm({ ...daycareForm, description: e.target.value })}
              rows={3}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={createDaycareMutation.isPending}>
            {createDaycareMutation.isPending ? 'Creating...' : 'Create Daycare'}
          </button>
        </form>
      </div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Location</th>
            <th>Capacity</th>
            <th>Enrollment</th>
            <th>Admins</th>
            <th>Active Placements</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {daycares?.map((daycare: any) => (
            <tr key={daycare.id}>
              <td>{daycare.name}</td>
              <td>{daycare.city}, {daycare.province}</td>
              <td>{daycare.capacity}</td>
              <td>{daycare.current_enrollment}</td>
              <td>{daycare.admin_count}</td>
              <td>{daycare.placement_count}</td>
              <td>
                <span className={`badge ${daycare.is_active ? 'badge-accepted' : 'badge-rejected'}`}>
                  {daycare.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderApplications = () => (
    <div>
      <h3>Application Management</h3>
      <table>
        <thead>
          <tr>
            <th>Child Name</th>
            <th>Parent</th>
            <th>Applied Date</th>
            <th>Start Date</th>
            <th>Has Placement</th>
            <th>Choices</th>
            <th>Networking</th>
          </tr>
        </thead>
        <tbody>
          {applications?.map((app: any) => (
            <tr key={app.application_id}>
              <td>{app.child_first_name} {app.child_last_name}</td>
              <td>
                {app.parent_first_name} {app.parent_last_name}
                <div style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
                  {app.parent_email}
                </div>
              </td>
              <td>{new Date(app.application_date).toLocaleDateString()}</td>
              <td>{new Date(app.desired_start_date).toLocaleDateString()}</td>
              <td>
                <span className={`badge ${app.has_placement ? 'badge-accepted' : 'badge-rejected'}`}>
                  {app.has_placement ? 'Yes' : 'No'}
                </span>
              </td>
              <td>{app.choices?.length || 0} daycares</td>
              <td>
                {app.opt_in_parent_network ? (
                  <span className="badge badge-accepted">Opted In</span>
                ) : (
                  <span className="badge badge-pending">Not Opted In</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderLogs = () => (
    <div>
      <h3>Audit Logs (Last 100)</h3>
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>User</th>
            <th>Action</th>
            <th>Resource</th>
            <th>IP Address</th>
          </tr>
        </thead>
        <tbody>
          {logs?.map((log: any) => (
            <tr key={log.id}>
              <td>{new Date(log.created_at).toLocaleString()}</td>
              <td>
                {log.user_email || 'System'}
                {log.first_name && (
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
                    {log.first_name} {log.last_name}
                  </div>
                )}
              </td>
              <td>{log.action}</td>
              <td>{log.resource_type}</td>
              <td style={{ fontSize: '0.875rem', fontFamily: 'monospace' }}>
                {log.ip_address}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <h2>System Administration</h2>

      <div style={{ borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '2rem' }}>
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'overview' ? '2px solid var(--primary-color)' : 'none',
              padding: '1rem 0',
              fontWeight: activeTab === 'overview' ? 'bold' : 'normal',
              color: activeTab === 'overview' ? 'var(--primary-color)' : 'var(--text-color)',
              cursor: 'pointer'
            }}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('users')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'users' ? '2px solid var(--primary-color)' : 'none',
              padding: '1rem 0',
              fontWeight: activeTab === 'users' ? 'bold' : 'normal',
              color: activeTab === 'users' ? 'var(--primary-color)' : 'var(--text-color)',
              cursor: 'pointer'
            }}
          >
            Users ({statistics?.users?.total || 0})
          </button>
          <button
            onClick={() => setActiveTab('daycares')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'daycares' ? '2px solid var(--primary-color)' : 'none',
              padding: '1rem 0',
              fontWeight: activeTab === 'daycares' ? 'bold' : 'normal',
              color: activeTab === 'daycares' ? 'var(--primary-color)' : 'var(--text-color)',
              cursor: 'pointer'
            }}
          >
            Daycares ({statistics?.daycares?.total || 0})
          </button>
          <button
            onClick={() => setActiveTab('applications')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'applications' ? '2px solid var(--primary-color)' : 'none',
              padding: '1rem 0',
              fontWeight: activeTab === 'applications' ? 'bold' : 'normal',
              color: activeTab === 'applications' ? 'var(--primary-color)' : 'var(--text-color)',
              cursor: 'pointer'
            }}
          >
            Applications ({statistics?.applications?.total || 0})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'logs' ? '2px solid var(--primary-color)' : 'none',
              padding: '1rem 0',
              fontWeight: activeTab === 'logs' ? 'bold' : 'normal',
              color: activeTab === 'logs' ? 'var(--primary-color)' : 'var(--text-color)',
              cursor: 'pointer'
            }}
          >
            Audit Logs
          </button>
        </div>
      </div>

      <div className="card">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'daycares' && renderDaycares()}
        {activeTab === 'applications' && renderApplications()}
        {activeTab === 'logs' && renderLogs()}
      </div>
    </div>
  );
}
