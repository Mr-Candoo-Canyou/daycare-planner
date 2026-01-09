import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { format } from 'date-fns';

export default function DaycareDashboard() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [selectedDaycareId, setSelectedDaycareId] = useState<string>('');
  const [statusUpdate, setStatusUpdate] = useState<{
    choiceId: string;
    status: string;
    notes: string;
  } | null>(null);

  // Get daycares this admin manages
  const { data: adminDaycares } = useQuery({
    queryKey: ['admin-daycares'],
    queryFn: async () => {
      // In a real implementation, we'd have an endpoint to get admin's daycares
      // For now, we'll use a workaround
      const response = await api.get('/daycares');
      return response.data.daycares;
    }
  });

  // Get waitlist for selected daycare
  const { data: waitlist, isLoading } = useQuery({
    queryKey: ['waitlist', selectedDaycareId],
    queryFn: async () => {
      if (!selectedDaycareId) return null;
      const response = await api.get(`/daycares/${selectedDaycareId}/waitlist`);
      return response.data.waitlist;
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
