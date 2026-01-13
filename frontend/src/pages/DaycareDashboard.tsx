import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { format } from 'date-fns';

export default function DaycareDashboard() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [selectedDaycareId, setSelectedDaycareId] = useState<string>('');
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
  const [waitlistError, setWaitlistError] = useState('');
  const [statusUpdate, setStatusUpdate] = useState<{
    choiceId: string;
    status: string;
    notes: string;
  } | null>(null);

  // Get daycares this admin manages
  const { data: adminDaycares } = useQuery({
    queryKey: ['admin-daycares'],
    queryFn: async () => {
      const response = await api.get('/daycares/my-daycares');
      return response.data.daycares;
    }
  });

  // Get waitlist for selected daycare
  const { data: waitlist, isLoading } = useQuery({
    queryKey: ['waitlist', selectedDaycareId],
    queryFn: async () => {
      if (!selectedDaycareId) return null;
      try {
        const response = await api.get(`/daycares/${selectedDaycareId}/waitlist`);
        setWaitlistError('');
        return response.data.waitlist;
      } catch (error: any) {
        setWaitlistError(error?.response?.data?.error || 'Failed to load applications.');
        return null;
      }
    },
    enabled: !!selectedDaycareId
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ choiceId, status, notes }: { choiceId: string; status: string; notes: string }) => {
      const response = await api.patch(`/daycares/applications/${choiceId}/status`, {
        status,
        statusNotes: notes
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist', selectedDaycareId] });
      setStatusUpdate(null);
    }
  });

  const updateDaycareMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDaycareId) return;
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

      await api.patch(`/daycares/${selectedDaycareId}`, payload);
    },
    onSuccess: () => {
      setDaycareSuccess('Daycare updated.');
      setDaycareError('');
      queryClient.invalidateQueries({ queryKey: ['admin-daycares'] });
    },
    onError: (error: any) => {
      setDaycareSuccess('');
      setDaycareError(error?.response?.data?.error || 'Failed to update daycare.');
    }
  });

  useEffect(() => {
    if (!selectedDaycareId || !adminDaycares) return;
    const selected = adminDaycares.find((daycare: any) => daycare.id === selectedDaycareId);
    if (!selected) return;
    setDaycareForm({
      name: selected.name || '',
      address: selected.address || '',
      city: selected.city || '',
      province: selected.province || '',
      postalCode: selected.postal_code || '',
      phone: selected.phone || '',
      email: selected.email || '',
      capacity: selected.capacity?.toString() || '',
      ageRangeMin: selected.age_range_min?.toString() || '',
      ageRangeMax: selected.age_range_max?.toString() || '',
      languages: Array.isArray(selected.languages) ? selected.languages.join(', ') : '',
      hasSubsidyProgram: !!selected.has_subsidy_program,
      description: selected.description || ''
    });
    setDaycareError('');
    setDaycareSuccess('');
    setWaitlistError('');
  }, [adminDaycares, selectedDaycareId]);

  const handleStatusChange = (choiceId: string) => {
    if (!statusUpdate) return;
    updateStatusMutation.mutate({
      choiceId: statusUpdate.choiceId,
      status: statusUpdate.status,
      notes: statusUpdate.notes
    });
  };

  if (!adminDaycares || adminDaycares.length === 0) {
    return (
      <div className="card">
        <h3>No Daycares Found</h3>
        <p>You don't have administrator access to any daycares yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Waitlist Management</h2>

      <div className="card">
        <div className="form-group">
          <label>Select Daycare:</label>
          <select
            value={selectedDaycareId}
            onChange={(e) => setSelectedDaycareId(e.target.value)}
          >
            <option value="">Choose a daycare...</option>
            {adminDaycares.map((daycare: any) => (
              <option key={daycare.id} value={daycare.id}>
                {daycare.name} - {daycare.current_enrollment}/{daycare.capacity} enrolled
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedDaycareId && (
        <>
          <div className="card">
            <h3>Daycare Details</h3>
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
                updateDaycareMutation.mutate();
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
              <button type="submit" className="btn-primary" disabled={updateDaycareMutation.isPending}>
                {updateDaycareMutation.isPending ? 'Updating...' : 'Save Changes'}
              </button>
            </form>
          </div>
          {waitlistError && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              {waitlistError}
            </div>
          )}
          {isLoading ? (
            <div className="loading">Loading waitlist...</div>
          ) : waitlist && waitlist.length > 0 ? (
            <div className="card">
              <h3>Waitlist Applications</h3>
              <p style={{ color: 'var(--text-light)', marginBottom: '1rem' }}>
                Total applications: {waitlist.length}
              </p>

              <table>
                <thead>
                  <tr>
                    <th>Child Name</th>
                    <th>Age</th>
                    <th>Applied Date</th>
                    <th>Start Date</th>
                    <th>Current Placement</th>
                    <th>Status</th>
                    <th>Preference Rank</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {waitlist.map((item: any) => (
                    <tr key={item.choice_id}>
                      <td>
                        <div>
                          <strong>{item.first_name} {item.last_name}</strong>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
                            Parent: {item.parent_first_name} {item.parent_last_name}
                          </div>
                        </div>
                      </td>
                      <td>
                        {Math.floor((Date.now() - new Date(item.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} years
                      </td>
                      <td>{format(new Date(item.application_date), 'MMM d, yyyy')}</td>
                      <td>{format(new Date(item.desired_start_date), 'MMM d, yyyy')}</td>
                      <td>
                        {item.has_current_placement ? (
                          <span className="badge badge-accepted">
                            {item.current_placement?.name || 'Placed'}
                          </span>
                        ) : (
                          <span className="badge badge-rejected">No placement</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge badge-${item.status}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>#{item.preference_rank}</td>
                      <td>
                        <button
                          className="btn-primary"
                          style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                          onClick={() => setStatusUpdate({
                            choiceId: item.choice_id,
                            status: item.status,
                            notes: ''
                          })}
                        >
                          Update Status
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card">
              <p style={{ textAlign: 'center', color: 'var(--text-light)' }}>
                No pending applications in the waitlist.
              </p>
            </div>
          )}
        </>
      )}

      {statusUpdate && (
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
          <div className="card" style={{ maxWidth: '500px', width: '100%' }}>
            <h3>Update Application Status</h3>

            <div className="form-group">
              <label>Status</label>
              <select
                value={statusUpdate.status}
                onChange={(e) => setStatusUpdate({ ...statusUpdate, status: e.target.value })}
              >
                <option value="pending">Pending Review</option>
                <option value="waitlisted">Waitlisted</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="form-group">
              <label>Notes (Optional)</label>
              <textarea
                value={statusUpdate.notes}
                onChange={(e) => setStatusUpdate({ ...statusUpdate, notes: e.target.value })}
                placeholder="Reason for decision, additional information, etc."
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                className="btn-outline"
                onClick={() => setStatusUpdate(null)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => handleStatusChange(statusUpdate.choiceId)}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
