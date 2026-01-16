import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import api from '../api/client';
import { Statistics, User, Daycare } from '../types';

export const AdminDashboardScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'daycares'>('overview');
  const [newDaycare, setNewDaycare] = useState({
    name: '',
    address: '',
    city: '',
    province: '',
    capacity: '',
  });
  const [assignAdminId, setAssignAdminId] = useState('');
  const [assignDaycareId, setAssignDaycareId] = useState('');
  const [editUserId, setEditUserId] = useState('');
  const [editUser, setEditUser] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
  });

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
  });

  const { data: unassignedAdmins } = useQuery({
    queryKey: ['admin-unassigned-daycare-admins'],
    queryFn: async () => {
      const response = await api.get<{ admins: User[] }>('/admin/unassigned-daycare-admins');
      return response.data.admins;
    },
  });

  const selectedUser = useMemo(
    () => users?.find((u) => u.id === editUserId) || null,
    [users, editUserId]
  );

  const handleRefresh = () => {
    refetchStats();
    if (activeTab === 'users') refetchUsers();
    if (activeTab === 'daycares') refetchDaycares();
  };

  const handleCreateDaycare = async () => {
    if (!newDaycare.name || !newDaycare.address || !newDaycare.city || !newDaycare.province || !newDaycare.capacity) {
      return;
    }
    try {
      await api.post('/daycares', {
        ...newDaycare,
        capacity: Number(newDaycare.capacity),
      });
      setNewDaycare({ name: '', address: '', city: '', province: '', capacity: '' });
      refetchDaycares();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to create daycare.');
    }
  };

  const handleAssignAdmin = async () => {
    if (!assignAdminId || !assignDaycareId) return;
    try {
      await api.post('/admin/assign-daycare-admin', {
        userId: assignAdminId,
        daycareId: assignDaycareId,
      });
      setAssignAdminId('');
      setAssignDaycareId('');
      refetchUsers();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to assign admin.');
    }
  };

  const handleUserUpdate = async () => {
    if (!editUserId) return;
    try {
      await api.patch(`/admin/users/${editUserId}`, editUser);
      refetchUsers();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to update user.');
    }
  };

  const toggleUserStatus = async (target: User) => {
    try {
      await api.patch(`/admin/users/${target.id}/status`, { isActive: !target.is_active });
      refetchUsers();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to update status.');
    }
  };

  useEffect(() => {
    if (selectedUser) {
      setEditUser({
        email: selectedUser.email || '',
        firstName: selectedUser.first_name || '',
        lastName: selectedUser.last_name || '',
        phone: selectedUser.phone || '',
      });
    }
  }, [selectedUser]);

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

      <Text style={styles.sectionTitle}>Create Daycare</Text>
      <Card>
        <Input
          label="Name"
          value={newDaycare.name}
          onChangeText={(value) => setNewDaycare((prev) => ({ ...prev, name: value }))}
          placeholder="Daycare name"
        />
        <Input
          label="Address"
          value={newDaycare.address}
          onChangeText={(value) => setNewDaycare((prev) => ({ ...prev, address: value }))}
          placeholder="123 Main St"
        />
        <Input
          label="City"
          value={newDaycare.city}
          onChangeText={(value) => setNewDaycare((prev) => ({ ...prev, city: value }))}
          placeholder="Iqaluit"
        />
        <Input
          label="Province"
          value={newDaycare.province}
          onChangeText={(value) => setNewDaycare((prev) => ({ ...prev, province: value }))}
          placeholder="NU"
        />
        <Input
          label="Capacity"
          value={newDaycare.capacity}
          onChangeText={(value) => setNewDaycare((prev) => ({ ...prev, capacity: value }))}
          placeholder="30"
          keyboardType="numeric"
        />
        <Button title="Create Daycare" onPress={handleCreateDaycare} />
      </Card>

      <Text style={styles.sectionTitle}>Approve Daycare Administrators</Text>
      <Card>
        <Text style={styles.helperText}>Assign an unassigned daycare admin to a daycare.</Text>
        <Input
          label="Admin User ID"
          value={assignAdminId}
          onChangeText={setAssignAdminId}
          placeholder={unassignedAdmins?.[0]?.id || 'User ID'}
        />
        <Input
          label="Daycare ID"
          value={assignDaycareId}
          onChangeText={setAssignDaycareId}
          placeholder={daycares?.[0]?.id || 'Daycare ID'}
        />
        <Button title="Assign Admin" onPress={handleAssignAdmin} />
      </Card>
    </View>
  );

  const renderUsers = () => (
    <View>
      <Text style={styles.sectionTitle}>User Management</Text>
      <Card>
        <Input
          label="User ID"
          value={editUserId}
          onChangeText={setEditUserId}
          placeholder={users?.[0]?.id || 'Select user ID'}
        />
        <Input
          label="Email"
          value={editUser.email}
          onChangeText={(value) => setEditUser((prev) => ({ ...prev, email: value }))}
          placeholder={selectedUser?.email || 'email@example.com'}
          autoCapitalize="none"
        />
        <Input
          label="First Name"
          value={editUser.firstName}
          onChangeText={(value) => setEditUser((prev) => ({ ...prev, firstName: value }))}
          placeholder={selectedUser?.first_name || 'First'}
        />
        <Input
          label="Last Name"
          value={editUser.lastName}
          onChangeText={(value) => setEditUser((prev) => ({ ...prev, lastName: value }))}
          placeholder={selectedUser?.last_name || 'Last'}
        />
        <Input
          label="Phone"
          value={editUser.phone}
          onChangeText={(value) => setEditUser((prev) => ({ ...prev, phone: value }))}
          placeholder={selectedUser?.phone || 'Phone'}
        />
        <Button title="Update User" onPress={handleUserUpdate} />
      </Card>
      {users?.map((u) => (
        <Card key={u.id}>
          <View style={styles.userRow}>
            <View style={styles.userInfo}>
              <Text style={styles.userListName}>
                {u.first_name} {u.last_name}
              </Text>
              <Text style={styles.userEmail}>{u.email}</Text>
              <Text style={styles.userRole}>{u.role.replace('_', ' ').toUpperCase()}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: u.is_active ? '#22c55e' : '#ef4444' }]}>
              <Text style={styles.statusText}>{u.is_active ? 'Active' : 'Inactive'}</Text>
            </View>
          </View>
          <Button
            title={u.is_active ? 'Deactivate' : 'Activate'}
            onPress={() => toggleUserStatus(u)}
            variant="outline"
            style={styles.userAction}
          />
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

      <View style={styles.quickActions}>
        <Button
          title="Parent View"
          onPress={() => navigation.navigate('ParentDashboard')}
          variant="outline"
          style={styles.quickButton}
        />
        <Button
          title="Daycare View"
          onPress={() => navigation.navigate('DaycareDashboard')}
          variant="outline"
          style={styles.quickButton}
        />
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
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
  },
  quickButton: {
    minHeight: 36,
    paddingVertical: 6,
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
  userListName: {
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
  userAction: {
    marginTop: 12,
  },
  helperText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
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
