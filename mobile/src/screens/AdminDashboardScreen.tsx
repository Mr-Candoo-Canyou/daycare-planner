import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import api from '../api/client';
import { Statistics, User, Daycare } from '../types';

export const AdminDashboardScreen = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'daycares'>('overview');

  const { data: statistics, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['admin-statistics'],
    queryFn: async () => {
      const response = await api.get<{ statistics: Statistics }>('/admin/statistics');
      return response.data.statistics;
    },
  });

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const response = await api.get<{ users: User[] }>('/admin/users');
      return response.data.users;
    },
    enabled: activeTab === 'users',
  });

  const { data: daycares, isLoading: daycaresLoading, refetch: refetchDaycares } = useQuery({
    queryKey: ['admin-daycares'],
    queryFn: async () => {
      const response = await api.get<{ daycares: Daycare[] }>('/admin/daycares');
      return response.data.daycares;
    },
    enabled: activeTab === 'daycares',
  });

  const handleRefresh = () => {
    refetchStats();
    if (activeTab === 'users') refetchUsers();
    if (activeTab === 'daycares') refetchDaycares();
  };

  const renderOverview = () => (
    <View>
      <Text style={styles.sectionTitle}>System Overview</Text>
      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>{statistics?.users?.total || 0}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
          <View style={styles.statDetails}>
            <Text style={styles.statDetail}>Parents: {statistics?.users?.parents || 0}</Text>
            <Text style={styles.statDetail}>Admins: {statistics?.users?.daycare_admins || 0}</Text>
            <Text style={styles.statDetail}>Funders: {statistics?.users?.funders || 0}</Text>
          </View>
        </Card>

        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>{statistics?.daycares?.total || 0}</Text>
          <Text style={styles.statLabel}>Total Daycares</Text>
          <View style={styles.statDetails}>
            <Text style={styles.statDetail}>Capacity: {statistics?.daycares?.total_capacity || 0}</Text>
            <Text style={styles.statDetail}>Enrolled: {statistics?.daycares?.total_enrollment || 0}</Text>
          </View>
        </Card>

        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>{statistics?.applications?.total || 0}</Text>
          <Text style={styles.statLabel}>Applications</Text>
          <View style={styles.statDetails}>
            <Text style={styles.statDetail}>Pending: {statistics?.applications?.pending || 0}</Text>
            <Text style={styles.statDetail}>Accepted: {statistics?.applications?.accepted || 0}</Text>
          </View>
        </Card>

        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>{statistics?.placements?.total || 0}</Text>
          <Text style={styles.statLabel}>Placements</Text>
          <View style={styles.statDetails}>
            <Text style={styles.statDetail}>Subsidized: {statistics?.placements?.subsidized || 0}</Text>
          </View>
        </Card>
      </View>
    </View>
  );

  const renderUsers = () => (
    <View>
      <Text style={styles.sectionTitle}>User Management</Text>
      {users?.map((u) => (
        <Card key={u.id}>
          <View style={styles.userRow}>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {u.first_name} {u.last_name}
              </Text>
              <Text style={styles.userEmail}>{u.email}</Text>
              <Text style={styles.userRole}>{u.role.replace('_', ' ').toUpperCase()}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: u.is_active ? '#22c55e' : '#ef4444' }]}>
              <Text style={styles.statusText}>{u.is_active ? 'Active' : 'Inactive'}</Text>
            </View>
          </View>
        </Card>
      ))}
    </View>
  );

  const renderDaycares = () => (
    <View>
      <Text style={styles.sectionTitle}>Daycare Management</Text>
      {daycares?.map((daycare) => (
        <Card key={daycare.id}>
          <Text style={styles.daycareName}>{daycare.name}</Text>
          <Text style={styles.daycareDetail}>
            {daycare.city}, {daycare.province}
          </Text>
          <Text style={styles.daycareDetail}>
            Capacity: {daycare.current_enrollment}/{daycare.capacity}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: daycare.is_active ? '#22c55e' : '#ef4444', marginTop: 8 }]}>
            <Text style={styles.statusText}>{daycare.is_active ? 'Active' : 'Inactive'}</Text>
          </View>
        </Card>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>System Administration</Text>
          <Text style={styles.userName}>{user?.first_name} {user?.last_name}</Text>
        </View>
        <Button title="Logout" onPress={logout} variant="outline" style={styles.logoutButton} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && styles.activeTab]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>
            Users
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'daycares' && styles.activeTab]}
          onPress={() => setActiveTab('daycares')}
        >
          <Text style={[styles.tabText, activeTab === 'daycares' && styles.activeTabText]}>
            Daycares
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={statsLoading || usersLoading || daycaresLoading}
            onRefresh={handleRefresh}
          />
        }
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'daycares' && renderDaycares()}
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabText: {
    color: '#2563eb',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  statCard: {
    width: '50%',
    padding: 16,
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  statDetails: {
    marginTop: 4,
  },
  statDetail: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 2,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  userRole: {
    fontSize: 10,
    color: '#2563eb',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  daycareName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  daycareDetail: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
});
