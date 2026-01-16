import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import api from '../api/client';

interface FunderStats {
  totalChildren: number;
  childrenWithPlacements: number;
  childrenWithoutCare: number;
  activeApplications: number;
  totalDaycares: number;
  capacity: { total: number; enrolled: number; available: number };
  subsidies: { count: number; totalAmount: number };
  ageDistribution: { age_group: string; count: string }[];
}

interface NetworkRequest {
  id: string;
  desired_area: string;
  created_at: string;
  contact_email: string;
  first_name: string;
  last_name: string;
  number_of_children: string;
}

interface WaitlistAnalysis {
  city: string;
  province: string;
  total_waitlisted: string;
  without_current_care: string;
  avg_capacity: string;
  avg_enrollment: string;
}

export const FunderDashboardScreen = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<FunderStats | null>(null);
  const [requests, setRequests] = useState<NetworkRequest[]>([]);
  const [analysis, setAnalysis] = useState<WaitlistAnalysis[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, requestsRes, analysisRes] = await Promise.all([
        api.get<{ statistics: FunderStats }>('/reports/statistics'),
        api.get<{ requests: NetworkRequest[] }>('/reports/parent-network-requests'),
        api.get<{ analysis: WaitlistAnalysis[] }>('/reports/waitlist-analysis'),
      ]);
      setStats(statsRes.data.statistics);
      setRequests(requestsRes.data.requests);
      setAnalysis(analysisRes.data.analysis);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Funder Insights</Text>
          <Text style={styles.userName}>{user?.first_name} {user?.last_name}</Text>
        </View>
        <Button title="Logout" onPress={logout} variant="outline" style={styles.logoutButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>System Snapshot</Text>
        {loading && <Text style={styles.helper}>Loading reports...</Text>}
        {stats && (
          <View style={styles.statsGrid}>
            <Card style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalChildren}</Text>
              <Text style={styles.statLabel}>Children</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.activeApplications}</Text>
              <Text style={styles.statLabel}>Active Applications</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.childrenWithoutCare}</Text>
              <Text style={styles.statLabel}>Without Care</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.capacity.available}</Text>
              <Text style={styles.statLabel}>Available Seats</Text>
            </Card>
          </View>
        )}

        <Text style={styles.sectionTitle}>Parent Network Requests</Text>
        {requests.length === 0 && (
          <Card>
            <Text style={styles.emptyText}>No active requests right now.</Text>
          </Card>
        )}
        {requests.map((request) => (
          <Card key={request.id}>
            <Text style={styles.requestName}>
              {request.first_name} {request.last_name}
            </Text>
            <Text style={styles.requestMeta}>Area: {request.desired_area || 'Not specified'}</Text>
            <Text style={styles.requestMeta}>Children: {request.number_of_children}</Text>
            <Text style={styles.requestMeta}>Contact: {request.contact_email}</Text>
          </Card>
        ))}

        <Text style={styles.sectionTitle}>Waitlist Analysis</Text>
        {analysis.length === 0 && (
          <Card>
            <Text style={styles.emptyText}>No waitlist data yet.</Text>
          </Card>
        )}
        {analysis.map((row) => (
          <Card key={`${row.city}-${row.province}`}>
            <Text style={styles.requestName}>{row.city}, {row.province}</Text>
            <Text style={styles.requestMeta}>Waitlisted: {row.total_waitlisted}</Text>
            <Text style={styles.requestMeta}>Without care: {row.without_current_care}</Text>
            <Text style={styles.requestMeta}>
              Avg enrollment: {row.avg_enrollment} / {row.avg_capacity}
            </Text>
          </Card>
        ))}
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
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
    marginBottom: 16,
  },
  statCard: {
    width: '50%',
    padding: 16,
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2563eb',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  requestMeta: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
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
