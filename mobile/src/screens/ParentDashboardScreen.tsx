import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import api from '../api/client';
import { Application, Child } from '../types';

export const ParentDashboardScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const { data: children, isLoading: childrenLoading } = useQuery({
    queryKey: ['children'],
    queryFn: async () => {
      const response = await api.get<{ children: Child[] }>('/children');
      return response.data.children;
    },
  });

  const { data: applications, isLoading: applicationsLoading, refetch } = useQuery({
    queryKey: ['applications'],
    queryFn: async () => {
      const response = await api.get<{ applications: Application[] }>('/applications');
      return response.data.applications;
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return '#22c55e';
      case 'waitlisted':
        return '#eab308';
      case 'rejected':
        return '#ef4444';
      default:
        return '#64748b';
    }
  };

  const getStatusBadge = (status: string) => {
    return (
      <View style={[styles.badge, { backgroundColor: getStatusColor(status) }]}>
        <Text style={styles.badgeText}>{status.toUpperCase()}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.first_name}!</Text>
        </View>
        <Button title="Logout" onPress={logout} variant="outline" style={styles.logoutButton} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={childrenLoading || applicationsLoading}
            onRefresh={() => {
              refetch();
              queryClient.invalidateQueries({ queryKey: ['children'] });
            }}
          />
        }
      >
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Children</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AddChild')}>
              <Text style={styles.addButton}>+ Add Child</Text>
            </TouchableOpacity>
          </View>

          {children && children.length > 0 ? (
            children.map((child) => (
              <Card key={child.id}>
                <Text style={styles.childName}>
                  {child.first_name} {child.last_name}
                </Text>
                <Text style={styles.childDetail}>
                  Date of Birth: {new Date(child.date_of_birth).toLocaleDateString()}
                </Text>
                {child.special_needs && (
                  <Text style={styles.childDetail}>Special Needs: {child.special_needs}</Text>
                )}
              </Card>
            ))
          ) : (
            <Card>
              <Text style={styles.emptyText}>No children added yet</Text>
              <Button
                title="Add Your First Child"
                onPress={() => navigation.navigate('AddChild')}
                style={{ marginTop: 12 }}
              />
            </Card>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Applications</Text>
            <TouchableOpacity onPress={() => navigation.navigate('NewApplication')}>
              <Text style={styles.addButton}>+ New Application</Text>
            </TouchableOpacity>
          </View>

          {applications && applications.length > 0 ? (
            applications.map((app) => (
              <Card key={app.id}>
                <Text style={styles.appChildName}>
                  {app.child_first_name} {app.child_last_name}
                </Text>
                <Text style={styles.appDetail}>
                  Applied: {new Date(app.application_date).toLocaleDateString()}
                </Text>
                <Text style={styles.appDetail}>
                  Desired Start: {new Date(app.desired_start_date).toLocaleDateString()}
                </Text>

                <View style={styles.choicesSection}>
                  <Text style={styles.choicesTitle}>Daycare Choices:</Text>
                  {app.choices.map((choice) => (
                    <View key={choice.id} style={styles.choiceRow}>
                      <Text style={styles.choiceRank}>#{choice.preference_rank}</Text>
                      <Text style={styles.choiceName}>{choice.daycare_name}</Text>
                      {getStatusBadge(choice.status)}
                    </View>
                  ))}
                </View>

                {app.opt_in_parent_network && (
                  <View style={styles.networkBadge}>
                    <Text style={styles.networkText}>📱 Parent Network Enabled</Text>
                  </View>
                )}
              </Card>
            ))
          ) : (
            <Card>
              <Text style={styles.emptyText}>No applications submitted yet</Text>
              <Button
                title="Create Application"
                onPress={() => navigation.navigate('NewApplication')}
                style={{ marginTop: 12 }}
              />
            </Card>
          )}
        </View>
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
    fontSize: 16,
    color: '#64748b',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 36,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  addButton: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  childName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  childDetail: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 2,
  },
  appChildName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  appDetail: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  choicesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  choicesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  choiceRank: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#64748b',
    width: 30,
  },
  choiceName: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  networkBadge: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#dbeafe',
    borderRadius: 6,
  },
  networkText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});
