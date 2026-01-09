import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function ApplicationForm() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [childId, setChildId] = useState('');
  const [newChild, setNewChild] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    hasSpecialNeeds: false,
    specialNeedsDescription: '',
    languagesSpokenAtHome: ''
  });
  const [applicationData, setApplicationData] = useState({
    desiredStartDate: '',
    notes: '',
    optInParentNetwork: false,
    desiredArea: ''
  });
  const [selectedDaycares, setSelectedDaycares] = useState<string[]>([]);
  const [error, setError] = useState('');

  const { data: children } = useQuery({
    queryKey: ['children'],
    queryFn: async () => {
      const response = await api.get('/children');
      return response.data.children;
    }
  });

  const { data: daycares } = useQuery({
    queryKey: ['daycares'],
    queryFn: async () => {
      const response = await api.get('/daycares');
      return response.data.daycares;
    }
  });

  const createChildMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/children', {
        firstName: newChild.firstName,
        lastName: newChild.lastName,
        dateOfBirth: newChild.dateOfBirth,
        hasSpecialNeeds: newChild.hasSpecialNeeds,
        specialNeedsDescription: newChild.specialNeedsDescription,
        languagesSpokenAtHome: newChild.languagesSpokenAtHome.split(',').map(l => l.trim())
      });
      return response.data.child;
    }
  });

  const submitApplicationMutation = useMutation({
    mutationFn: async (finalChildId: string) => {
      const response = await api.post('/applications', {
        childId: finalChildId,
        desiredStartDate: applicationData.desiredStartDate,
        notes: applicationData.notes,
        optInParentNetwork: applicationData.optInParentNetwork,
        desiredArea: applicationData.desiredArea,
        daycareChoices: selectedDaycares.map(id => ({ daycareId: id }))
      });
      return response.data;
    },
    onSuccess: () => {
      navigate('/parent/dashboard');
    }
  });

  const handleSubmit = async () => {
    setError('');

    try {
      let finalChildId = childId;

      // Create new child if needed
      if (childId === 'new') {
        const child = await createChildMutation.mutateAsync();
        finalChildId = child.id;
      }

      // Submit application
      await submitApplicationMutation.mutateAsync(finalChildId);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit application');
    }
  };

  const moveDaycareUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...selectedDaycares];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setSelectedDaycares(newOrder);
  };

  const moveDaycareDown = (index: number) => {
    if (index === selectedDaycares.length - 1) return;
    const newOrder = [...selectedDaycares];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setSelectedDaycares(newOrder);
  };

  const removeDaycare = (id: string) => {
    setSelectedDaycares(selectedDaycares.filter(d => d !== id));
  };

  return (
    <div>
      <h2>New Daycare Application</h2>

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      <div className="card">
        {step === 1 && (
          <div>
            <h3>Step 1: Select Child</h3>
            <div className="form-group">
              <label>Which child is this application for?</label>
              <select
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
                required
              >
                <option value="">Select a child...</option>
                {children?.map((child: any) => (
                  <option key={child.id} value={child.id}>
                    {child.first_name} {child.last_name}
                  </option>
                ))}
                <option value="new">+ Add New Child</option>
              </select>
            </div>

            {childId === 'new' && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                <h4>New Child Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>First Name</label>
                    <input
                      value={newChild.firstName}
                      onChange={(e) => setNewChild({ ...newChild, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input
                      value={newChild.lastName}
                      onChange={(e) => setNewChild({ ...newChild, lastName: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    value={newChild.dateOfBirth}
                    onChange={(e) => setNewChild({ ...newChild, dateOfBirth: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Languages Spoken at Home (comma-separated)</label>
                  <input
                    value={newChild.languagesSpokenAtHome}
                    onChange={(e) => setNewChild({ ...newChild, languagesSpokenAtHome: e.target.value })}
                    placeholder="English, French"
                  />
                </div>
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="specialNeeds"
                    checked={newChild.hasSpecialNeeds}
                    onChange={(e) => setNewChild({ ...newChild, hasSpecialNeeds: e.target.checked })}
                  />
                  <label htmlFor="specialNeeds">Child has special needs</label>
                </div>
                {newChild.hasSpecialNeeds && (
                  <div className="form-group">
                    <label>Special Needs Description</label>
                    <textarea
                      value={newChild.specialNeedsDescription}
                      onChange={(e) => setNewChild({ ...newChild, specialNeedsDescription: e.target.value })}
                    />
                  </div>
                )}
              </div>
            )}

            <button
              className="btn-primary"
              onClick={() => setStep(2)}
              disabled={!childId}
              style={{ marginTop: '1rem' }}
            >
              Next: Select Daycares
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3>Step 2: Select Daycares (Ranked Choice)</h3>
            <p style={{ color: 'var(--text-light)', marginBottom: '1rem' }}>
              Select daycares in order of preference. You can reorder them by using the arrows.
            </p>

            {selectedDaycares.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4>Your Ranked Choices:</h4>
                {selectedDaycares.map((id, index) => {
                  const daycare = daycares?.find((d: any) => d.id === id);
                  return (
                    <div
                      key={id}
                      style={{
                        padding: '0.75rem',
                        background: 'var(--bg-secondary)',
                        borderRadius: '6px',
                        marginBottom: '0.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <strong>#{index + 1}</strong> - {daycare?.name}
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
                          {daycare?.city}, {daycare?.province}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => moveDaycareUp(index)}
                          disabled={index === 0}
                          style={{ padding: '0.25rem 0.5rem' }}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveDaycareDown(index)}
                          disabled={index === selectedDaycares.length - 1}
                          style={{ padding: '0.25rem 0.5rem' }}
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => removeDaycare(id)}
                          className="btn-danger"
                          style={{ padding: '0.25rem 0.5rem' }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="form-group">
              <label>Add Daycare:</label>
              <select
                onChange={(e) => {
                  if (e.target.value && !selectedDaycares.includes(e.target.value)) {
                    setSelectedDaycares([...selectedDaycares, e.target.value]);
                    e.target.value = '';
                  }
                }}
              >
                <option value="">Select a daycare to add...</option>
                {daycares?.filter((d: any) => !selectedDaycares.includes(d.id)).map((daycare: any) => (
                  <option key={daycare.id} value={daycare.id}>
                    {daycare.name} - {daycare.city}, {daycare.province}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                className="btn-outline"
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <button
                className="btn-primary"
                onClick={() => setStep(3)}
                disabled={selectedDaycares.length === 0}
              >
                Next: Application Details
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3>Step 3: Application Details</h3>

            <div className="form-group">
              <label>Desired Start Date</label>
              <input
                type="date"
                value={applicationData.desiredStartDate}
                onChange={(e) => setApplicationData({ ...applicationData, desiredStartDate: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Additional Notes (Optional)</label>
              <textarea
                value={applicationData.notes}
                onChange={(e) => setApplicationData({ ...applicationData, notes: e.target.value })}
                placeholder="Any additional information you'd like to share..."
              />
            </div>

            <div className="alert alert-info" style={{ marginTop: '1.5rem' }}>
              <h4>Parent Networking (Optional)</h4>
              <p style={{ marginBottom: '1rem' }}>
                If you don't receive a daycare placement, would you like to be connected with other parents
                who are interested in starting their own childcare organization?
              </p>
              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="optInNetwork"
                  checked={applicationData.optInParentNetwork}
                  onChange={(e) => setApplicationData({ ...applicationData, optInParentNetwork: e.target.checked })}
                />
                <label htmlFor="optInNetwork">
                  Yes, connect me with other parents (your contact info will be shared with funders only)
                </label>
              </div>

              {applicationData.optInParentNetwork && (
                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label>Desired Geographic Area</label>
                  <input
                    value={applicationData.desiredArea}
                    onChange={(e) => setApplicationData({ ...applicationData, desiredArea: e.target.value })}
                    placeholder="e.g., Downtown Toronto, West End"
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                className="btn-outline"
                onClick={() => setStep(2)}
              >
                Back
              </button>
              <button
                className="btn-primary"
                onClick={handleSubmit}
                disabled={!applicationData.desiredStartDate || submitApplicationMutation.isPending}
              >
                {submitApplicationMutation.isPending ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
