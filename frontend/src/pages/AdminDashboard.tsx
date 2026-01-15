import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'daycares' | 'applications' | 'logs'>('overview');
  const [assigningAdmin, setAssigningAdmin] = useState<{userId: string; userName: string} | null>(null);
  const [editingDaycareId, setEditingDaycareId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
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
    description: '',
    isActive: true
  });
  const [userForm, setUserForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
    daycareId: ''
  });
  const [daycareError, setDaycareError] = useState('');
  const [daycareSuccess, setDaycareSuccess] = useState('');
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');

  const { data: statistics, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-statistics'],
    queryFn: async () => {
      const response = await api.get('/admin/statistics');
      return response.data.statistics;
    }
  });

  const { data: users, error: usersError, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const response = await api.get('/admin/users');
      return response.data.users;
    }
  });

  const { data: daycares, isLoading: daycaresLoading } = useQuery({
    queryKey: ['admin-daycares'],
    queryFn: async () => {
      const response = await api.get('/admin/daycares');
      return response.data.daycares;
    }
  });

  const { data: applications, isLoading: applicationsLoading } = useQuery({
    queryKey: ['admin-applications'],
    queryFn: async () => {
      const response = await api.get('/admin/applications');
      return response.data.applications;
    },
    enabled: activeTab === 'applications'
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
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
      queryClient.invalidateQueries({ queryKey: ['admin-statistics'] });
    }
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await api.patch(`/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-statistics'] });
    }
  });

  const assignDaycareAdminMutation = useMutation({
    mutationFn: async ({ userId, daycareId }: { userId: string; daycareId: string }) => {
      await api.post('/admin/assign-daycare-admin', { userId, daycareId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-daycares'] });
      setAssigningAdmin(null);
    }
  });

  const unassignDaycareAdminMutation = useMutation({
    mutationFn: async ({ userId, daycareId }: { userId: string; daycareId: string }) => {
      await api.delete('/admin/unassign-daycare-admin', { data: { userId, daycareId } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-daycares'] });
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!editingUserId) return;
      if (userForm.role === 'daycare_admin' && !userForm.daycareId) {
        throw new Error('Please select a daycare for this admin.');
      }
      await api.patch(`/admin/users/${editingUserId}`, {
        firstName: userForm.firstName.trim(),
        lastName: userForm.lastName.trim(),
        email: userForm.email.trim(),
        phone: userForm.phone.trim()
      });

      await api.patch(`/admin/users/${editingUserId}/daycare`, {
        daycareId: userForm.role === 'daycare_admin' ? userForm.daycareId : null
      });
    },
    onSuccess: () => {
      setUserSuccess('User updated.');
      setUserError('');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any) => {
      setUserSuccess('');
      setUserError(error?.response?.data?.error || error?.message || 'Failed to update user.');
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
      setEditingDaycareId(null);
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
        description: '',
        isActive: true
      });
      queryClient.invalidateQueries({ queryKey: ['admin-daycares'] });
      queryClient.invalidateQueries({ queryKey: ['admin-statistics'] });
    },
    onError: (error: any) => {
      setDaycareSuccess('');
      setDaycareError(error?.response?.data?.error || 'Failed to create daycare.');
    }
  });

  const updateDaycareMutation = useMutation({
    mutationFn: async () => {
      if (!editingDaycareId) return;
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
        description: daycareForm.description.trim(),
        isActive: daycareForm.isActive
      };

      await api.patch(`/daycares/${editingDaycareId}`, payload);
    },
    onSuccess: () => {
      setDaycareSuccess('Daycare updated.');
      setDaycareError('');
      queryClient.invalidateQueries({ queryKey: ['admin-daycares'] });
      queryClient.invalidateQueries({ queryKey: ['admin-statistics'] });
    },
    onError: (error: any) => {
      setDaycareSuccess('');
      setDaycareError(error?.response?.data?.error || 'Failed to update daycare.');
    }
  });

  const renderOverview = () => (
    <div>
      <h3>System Overview</h3>

      {statsLoading ? (
        <div className="loading">Loading statistics...</div>
      ) : (
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
      )}
    </div>
  );

  const renderUsers = () => (
    <div>
      <h3>User Management</h3>
      {usersLoading && (
        <div className="alert" style={{ marginBottom: '1rem' }}>
          Loading users...
        </div>
      )}
      {usersError && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {(usersError as any)?.response?.data?.error || 'Failed to load users.'}
        </div>
      )}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ marginTop: 0 }}>
          {editingUserId ? 'Edit User' : 'Select a user to edit'}
        </h4>
        {userError && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            {userError}
          </div>
        )}
        {userSuccess && (
          <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
            {userSuccess}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setUserError('');
            setUserSuccess('');
            updateUserMutation.mutate();
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="user-first-name">First Name</label>
              <input
                id="user-first-name"
                value={userForm.firstName}
                onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                required
                disabled={!editingUserId}
              />
            </div>
            <div className="form-group">
              <label htmlFor="user-last-name">Last Name</label>
              <input
                id="user-last-name"
                value={userForm.lastName}
                onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                required
                disabled={!editingUserId}
              />
            </div>
            <div className="form-group">
              <label htmlFor="user-email">Email</label>
              <input
                id="user-email"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                required
                disabled={!editingUserId}
              />
            </div>
            <div className="form-group">
              <label htmlFor="user-phone">Phone</label>
              <input
                id="user-phone"
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                disabled={!editingUserId}
              />
            </div>
            {userForm.role === 'daycare_admin' && (
              <div className="form-group">
                <label htmlFor="user-daycare">Assigned Daycare</label>
                <select
                  id="user-daycare"
                  value={userForm.daycareId}
                  onChange={(e) => setUserForm({ ...userForm, daycareId: e.target.value })}
                  required
                  disabled={!editingUserId}
                >
                  <option value="">Select a daycare...</option>
                  {daycares?.map((daycare: any) => (
                    <option key={daycare.id} value={daycare.id}>
                      {daycare.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={!editingUserId || updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
            {editingUserId && (
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setEditingUserId(null);
                  setUserError('');
                  setUserSuccess('');
                  setUserForm({
                    firstName: '',
                    lastName: '',
                    email: '',
                    phone: '',
                    role: '',
                    daycareId: ''
                  });
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Assigned Daycares</th>
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
                  onChange={(e) => {
                    const nextRole = e.target.value;
                    updateUserRoleMutation.mutate(
                      { userId: user.id, role: nextRole },
                      {
                        onSuccess: async () => {
                          if (nextRole !== 'daycare_admin') {
                            await api.patch(`/admin/users/${user.id}/daycare`, { daycareId: null });
                          }
                        }
                      }
                    );

                    if (editingUserId === user.id) {
                      setUserForm((prev) => ({
                        ...prev,
                        role: nextRole,
                        daycareId: nextRole === 'daycare_admin' ? prev.daycareId : ''
                      }));
                    }
                  }}
                  style={{ padding: '0.25rem' }}
                >
                  <option value="parent">Parent</option>
                  <option value="daycare_admin">Daycare Admin</option>
                  <option value="funder">Funder</option>
                  <option value="system_admin">System Admin</option>
                </select>
              </td>
              <td>
                {user.role === 'daycare_admin' ? (
                  <div>
                    {user.assigned_daycares && user.assigned_daycares.length > 0 ? (
                      <>
                        {user.assigned_daycares.map((dc: any) => (
                          <div key={dc.daycareId} style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="badge badge-accepted">{dc.daycareName}</span>
                            <button
                              onClick={() => {
                                if (confirm(`Remove ${user.first_name} ${user.last_name} from ${dc.daycareName}?`)) {
                                  unassignDaycareAdminMutation.mutate({ userId: user.id, daycareId: dc.daycareId });
                                }
                              }}
                              style={{ padding: '0.1rem 0.3rem', fontSize: '0.75rem' }}
                              className="btn-danger"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setAssigningAdmin({ userId: user.id, userName: `${user.first_name} ${user.last_name}` })}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', marginTop: '0.25rem' }}
                          className="btn-primary"
                        >
                          + Add Daycare
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setAssigningAdmin({ userId: user.id, userName: `${user.first_name} ${user.last_name}` })}
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                        className="btn-primary"
                      >
                        Assign to Daycare
                      </button>
                    )}
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-light)' }}>—</span>
                )}
              </td>
              <td>
                <span className={`badge ${user.is_active ? 'badge-accepted' : 'badge-rejected'}`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>{new Date(user.created_at).toLocaleDateString()}</td>
              <td>{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
              <td>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => {
                      setEditingUserId(user.id);
                      setUserError('');
                      setUserSuccess('');
                      setUserForm({
                        firstName: user.first_name || '',
                        lastName: user.last_name || '',
                        email: user.email || '',
                        phone: user.phone || '',
                        role: user.role || '',
                        daycareId: user.daycare_id || ''
                      });
                    }}
                    className="btn-outline"
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => updateUserStatusMutation.mutate({ userId: user.id, isActive: !user.is_active })}
                    className={user.is_active ? 'btn-danger' : 'btn-secondary'}
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                  >
                    {user.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
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
        <h4 style={{ marginTop: 0 }}>
          {editingDaycareId ? 'Edit Daycare' : 'Create Daycare'}
        </h4>
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
            if (editingDaycareId) {
              updateDaycareMutation.mutate();
            } else {
              createDaycareMutation.mutate();
            }
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
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                id="daycare-active"
                type="checkbox"
                checked={daycareForm.isActive}
                onChange={(e) => setDaycareForm({ ...daycareForm, isActive: e.target.checked })}
              />
              <label htmlFor="daycare-active">Active</label>
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
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={createDaycareMutation.isPending || updateDaycareMutation.isPending}
            >
              {editingDaycareId
                ? (updateDaycareMutation.isPending ? 'Updating...' : 'Update Daycare')
                : (createDaycareMutation.isPending ? 'Creating...' : 'Create Daycare')}
            </button>
            {editingDaycareId && (
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setEditingDaycareId(null);
                  setDaycareError('');
                  setDaycareSuccess('');
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
                    description: '',
                    isActive: true
                  });
                }}
              >
                Cancel
              </button>
            )}
          </div>
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
            <th>Actions</th>
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
              <td>
                <button
                  className="btn-outline"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                  onClick={() => {
                    setEditingDaycareId(daycare.id);
                    setDaycareError('');
                    setDaycareSuccess('');
                    setDaycareForm({
                      name: daycare.name || '',
                      address: daycare.address || '',
                      city: daycare.city || '',
                      province: daycare.province || '',
                      postalCode: daycare.postal_code || '',
                      phone: daycare.phone || '',
                      email: daycare.email || '',
                      capacity: daycare.capacity?.toString() || '',
                      ageRangeMin: daycare.age_range_min?.toString() || '',
                      ageRangeMax: daycare.age_range_max?.toString() || '',
                      languages: Array.isArray(daycare.languages) ? daycare.languages.join(', ') : '',
                      hasSubsidyProgram: !!daycare.has_subsidy_program,
                      description: daycare.description || '',
                      isActive: daycare.is_active !== false
                    });
                  }}
                >
                  Edit
                </button>
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
      {applicationsLoading ? (
        <div className="loading">Loading applications...</div>
      ) : applications && applications.length > 0 ? (
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
            {applications.map((app: any) => (
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
      ) : (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
          No applications found
        </div>
      )}
    </div>
  );

  const renderLogs = () => (
    <div>
      <h3>Audit Logs (Last 100)</h3>
      {logsLoading ? (
        <div className="loading">Loading logs...</div>
      ) : logs && logs.length > 0 ? (
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
            {logs.map((log: any) => (
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
      ) : (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
          No audit logs found
        </div>
      )}
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

      {/* Assign Daycare Admin Modal */}
      {assigningAdmin && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', maxHeight: '80vh', overflow: 'auto' }}>
            <h3>Assign {assigningAdmin.userName} to Daycare</h3>

            {daycaresLoading ? (
              <div className="loading">Loading daycares...</div>
            ) : daycares && daycares.length > 0 ? (
              <div style={{ marginTop: '1rem' }}>
                {daycares.map((daycare: any) => (
                  <div key={daycare.id} style={{
                    padding: '1rem',
                    marginBottom: '0.5rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <strong>{daycare.name}</strong>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
                        {daycare.city}, {daycare.province}
                      </div>
                    </div>
                    <button
                      onClick={() => assignDaycareAdminMutation.mutate({
                        userId: assigningAdmin.userId,
                        daycareId: daycare.id
                      })}
                      className="btn-primary"
                      style={{ padding: '0.5rem 1rem' }}
                      disabled={assignDaycareAdminMutation.isPending}
                    >
                      Assign
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-light)' }}>
                No daycares available. Create a daycare first.
              </div>
            )}

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setAssigningAdmin(null)}
                className="btn-outline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
