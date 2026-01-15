import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { Button } from '../components/Button';

export const LandingScreen = ({ navigation }: any) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Daycare Planner</Text>
        <Text style={styles.tagline}>
          Simplify your daycare search with our privacy-focused waitlist management system
        </Text>
      </View>

      <View style={styles.features}>
        <View style={styles.feature}>
          <Text style={styles.featureIcon}>🏫</Text>
          <Text style={styles.featureTitle}>Ranked Choice Applications</Text>
          <Text style={styles.featureDescription}>
            Apply to multiple daycares at once, ranked by your preference
          </Text>
        </View>

        <View style={styles.feature}>
          <Text style={styles.featureIcon}>🔒</Text>
          <Text style={styles.featureTitle}>Privacy-First</Text>
          <Text style={styles.featureDescription}>
            Your data is protected with enterprise-grade security and privacy controls
          </Text>
        </View>

        <View style={styles.feature}>
          <Text style={styles.featureIcon}>👥</Text>
          <Text style={styles.featureTitle}>Parent Network</Text>
          <Text style={styles.featureDescription}>
            Connect with other parents (opt-in only) for support and information
          </Text>
        </View>

        <View style={styles.feature}>
          <Text style={styles.featureIcon}>📊</Text>
          <Text style={styles.featureTitle}>Transparent Process</Text>
          <Text style={styles.featureDescription}>
            Track your application status in real-time across all your choices
          </Text>
        </View>
      </View>

      <View style={styles.ctaSection}>
        <Text style={styles.ctaTitle}>Ready to get started?</Text>
        <Button
          title="Create Account"
          onPress={() => navigation.navigate('Register')}
          style={styles.primaryButton}
        />
        <Button
          title="Login"
          onPress={() => navigation.navigate('Login')}
          variant="outline"
          style={styles.secondaryButton}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Helping families find quality childcare since 2024
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    paddingVertical: 60,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 18,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 26,
  },
  features: {
    paddingHorizontal: 24,
    marginBottom: 40,
  },
  feature: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  featureIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  ctaSection: {
    paddingHorizontal: 24,
    marginBottom: 40,
  },
  ctaTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    marginBottom: 12,
  },
  secondaryButton: {
    marginBottom: 12,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
