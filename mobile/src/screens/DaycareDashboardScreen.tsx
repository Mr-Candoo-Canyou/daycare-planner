import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Pressable } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import api from '../api/client';
import { Daycare } from '../types';

interface WaitlistEntry {
  choice_id: string;
  preference_rank: number;
  status: 'pending' | 'waitlisted' | 'accepted' | 'rejected';
  application_date: string;
  desired_start_date: string;
  child_first_name: string;
  child_last_name: string;
  languages_spoken_at_home?: string[];
  is_inuk?: boolean;
  has_current_placement?: boolean;
  parent_first_name: string;
  parent_last_name: string;
}

interface EnrollmentEntry {
  placement_id: string;
  start_date: string;
  child_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  is_inuk?: boolean;
  languages_spoken_at_home?: string[];
  parent_first_name: string;
  parent_last_name: string;
}

export const DaycareDashboardScreen = () => {
  const { user, logout } = useAuth();
  const [daycares, setDaycares] = useState<Daycare[]>([]);
  const [selectedDaycare, setSelectedDaycare] = useState<Daycare | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentEntry[]>([]);
  const [policy, setPolicy] = useState('application_date');
  const [loading, setLoading] = useState(false);

  const loadDaycares = async () => {
    try {
      const response = await api.get<{ daycares: Daycare[] }>('/daycares/my-daycares');
      setDaycares(response.data.daycares);
      if (response.data.daycares.length > 0) {
        setSelectedDaycare(response.data.daycares[0]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to load daycares.');
    }
  };

  const loadWaitlist = async (daycareId: string, sortPolicy: string) => {
    setLoading(true);
    try {
      const response = await api.get<{ waitlist: WaitlistEntry[] }>(
        `/daycares/${daycareId}/waitlist`,
        { params: { policy: sortPolicy } }
      );
      setWaitlist(response.data.waitlist);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to load waitlist.');
    } finally {
      setLoading(false);
    }
  };

  const loadEnrollments = async (daycareId: string) => {
    try {
      const response = await api.get<{ enrollments: EnrollmentEntry[] }>(
        `/daycares/${daycareId}/enrollments`
      );
      setEnrollments(response.data.enrollments);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to load enrollments.');
    }
  };

  const updateStatus = async (choiceId: string, status: WaitlistEntry['status']) => {
    try {
      await api.patch(`/daycares/applications/${choiceId}/status`, { status });
      if (selectedDaycare) {
        await loadWaitlist(selectedDaycare.id, policy);
        await loadEnrollments(selectedDaycare.id);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to update status.');
    }
  };

  const removeEnrollment = async (placementId: string) => {
    try {
      await api.patch(`/daycares/enrollments/${placementId}/end`);
      if (selectedDaycare) {
        await loadEnrollments(selectedDaycare.id);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to remove child.');
    }
  };

  useEffect(() => {
    loadDaycares();
  }, []);

  useEffect(() => {
    if (selectedDaycare) {
      loadWaitlist(selectedDaycare.id, policy);
      loadEnrollments(selectedDaycare.id);
    }
  }, [selectedDaycare?.id, policy]);

  const savePolicy = async () => {
    if (!selectedDaycare) return;
    try {
      await api.patch(`/daycares/${selectedDaycare.id}`, { waitlistPolicy: policy });
      Alert.alert('Saved', 'Waitlist policy updated.');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to save policy.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Daycare Administration</Text>
          <Text style={styles.userName}>{user?.first_name} {user?.last_name}</Text>
        </View>
        <Button title="Logout" onPress={logout} variant="outline" style={styles.logoutButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>My Daycares</Text>
        {daycares.length === 0 && (
          <Card>
            <Text style={styles.emptyText}>No daycares assigned yet.</Text>
          </Card>
        )}

        {daycares.map((daycare) => (
          <Pressable
            key={daycare.id}
            style={[
              styles.daycareCard,
              selectedDaycare?.id === daycare.id && styles.daycareCardActive,
            ]}
            onPress={() => setSelectedDaycare(daycare)}
          >
            <Text style={styles.daycareName}>{daycare.name}</Text>
            <Text style={styles.daycareMeta}>
              {daycare.city}, {daycare.province} · {daycare.current_enrollment}/{daycare.capacity}
            </Text>
          </Pressable>
        ))}

        {selectedDaycare && (
          <>
            <Text style={styles.sectionTitle}>Enrolled Children</Text>
            {enrollments.length === 0 && (
              <Card>
                <Text style={styles.emptyText}>No enrolled children yet.</Text>
              </Card>
            )}
            {enrollments.map((entry) => (
              <Card key={entry.placement_id}>
                <Text style={styles.waitlistName}>
                  {entry.first_name} {entry.last_name}
                </Text>
                <Text style={styles.waitlistMeta}>
                  Parent: {entry.parent_first_name} {entry.parent_last_name}
                </Text>
                <Text style={styles.waitlistMeta}>
                  Start: {new Date(entry.start_date).toLocaleDateString()}
                </Text>
                <Text style={styles.waitlistMeta}>
                  Inuk: {entry.is_inuk ? 'Yes' : 'No'} · Languages:{' '}
                  {(entry.languages_spoken_at_home || []).join(', ') || 'Not specified'}
                </Text>
                <Button
                  title="Remove from Daycare"
                  onPress={() => removeEnrollment(entry.placement_id)}
                  variant="danger"
                  style={styles.removeButton}
                />
              </Card>
            ))}

            <Text style={styles.sectionTitle}>Waitlist</Text>
            <View style={styles.policyRow}>
              {[
                { key: 'application_date', label: 'Date' },
                { key: 'language', label: 'Language' },
                { key: 'inuk', label: 'Inuk' },
                { key: 'enrolled_elsewhere', label: 'Enrolled Elsewhere' },
                { key: 'random', label: 'Random' },
              ].map((option) => (
                <Pressable
                  key={option.key}
                  style={[
                    styles.policyChip,
                    policy === option.key && styles.policyChipActive,
                  ]}
                  onPress={() => setPolicy(option.key)}
                >
                  <Text style={[
                    styles.policyChipText,
                    policy === option.key && styles.policyChipTextActive,
                  ]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Button title="Save Policy" onPress={savePolicy} variant="outline" style={styles.savePolicy} />
            {loading && <Text style={styles.helper}>Loading waitlist...</Text>}
            {!loading && waitlist.length === 0 && (
              <Card>
                <Text style={styles.emptyText}>No waitlist entries right now.</Text>
              </Card>
            )}
            {waitlist.map((entry) => (
              <Card key={entry.choice_id}>
                <Text style={styles.waitlistName}>
                  {entry.child_first_name} {entry.child_last_name}
                </Text>
                <Text style={styles.waitlistMeta}>
                  Parent: {entry.parent_first_name} {entry.parent_last_name}
                </Text>
                <Text style={styles.waitlistMeta}>
                  Desired start: {new Date(entry.desired_start_date).toLocaleDateString()}
                </Text>
                <Text style={styles.waitlistMeta}>
                  Applied: {new Date(entry.application_date).toLocaleDateString()}
                </Text>
                <Text style={styles.waitlistMeta}>
                  Inuk: {entry.is_inuk ? 'Yes' : 'No'} · Languages:{' '}
                  {(entry.languages_spoken_at_home || []).join(', ') || 'Not specified'}
                </Text>
                <Text style={styles.waitlistMeta}>
                  Enrolled elsewhere: {entry.has_current_placement ? 'Yes' : 'No'}
                </Text>
                <Text style={styles.waitlistMeta}>Status: {entry.status}</Text>
                <View style={styles.statusButtons}>
                  <Button title="Accept" onPress={() => updateStatus(entry.choice_id, 'accepted')} />
                  <Button title="Waitlist" onPress={() => updateStatus(entry.choice_id, 'waitlisted')} variant="outline" />
                  <Button title="Reject" onPress={() => updateStatus(entry.choice_id, 'rejected')} variant="danger" />
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  greeting: {
    fontSize: 14,
    color: '#64748b',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 36,
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  daycareCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  daycareCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  daycareName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  daycareMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  waitlistName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  waitlistMeta: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  statusButtons: {
    marginTop: 12,
    gap: 8,
  },
  removeButton: {
    marginTop: 12,
  },
  policyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  policyChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  policyChipActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  policyChipText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  policyChipTextActive: {
    color: '#2563eb',
  },
  savePolicy: {
    marginBottom: 8,
    minHeight: 36,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  helper: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
});
