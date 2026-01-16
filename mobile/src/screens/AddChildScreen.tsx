import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Switch } from 'react-native';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import api from '../api/client';

export const AddChildScreen = ({ navigation }: any) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [hasSpecialNeeds, setHasSpecialNeeds] = useState(false);
  const [specialNeedsDescription, setSpecialNeedsDescription] = useState('');
  const [isInuk, setIsInuk] = useState(false);
  const [languages, setLanguages] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!firstName || !lastName || !dateOfBirth) {
      Alert.alert('Missing Info', 'First name, last name, and date of birth are required.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/children', {
        firstName,
        lastName,
        dateOfBirth,
        hasSpecialNeeds,
        specialNeedsDescription: hasSpecialNeeds ? specialNeedsDescription : null,
        isInuk,
        languagesSpokenAtHome: languages
          ? languages.split(',').map((value) => value.trim()).filter(Boolean)
          : [],
        siblingsInCare: [],
      });
      Alert.alert('Success', 'Child added successfully.');
      navigation.navigate('ParentDashboard');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to add child.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Add Child</Text>
      <Text style={styles.subtitle}>Enter your child’s details to start an application.</Text>

      <Input
        label="First Name"
        value={firstName}
        onChangeText={setFirstName}
        placeholder="Enter first name"
      />
      <Input
        label="Last Name"
        value={lastName}
        onChangeText={setLastName}
        placeholder="Enter last name"
      />
      <Input
        label="Date of Birth (YYYY-MM-DD)"
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
        placeholder="2021-04-15"
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Special needs?</Text>
        <Switch value={hasSpecialNeeds} onValueChange={setHasSpecialNeeds} />
      </View>

      {hasSpecialNeeds && (
        <Input
          label="Special Needs Details"
          value={specialNeedsDescription}
          onChangeText={setSpecialNeedsDescription}
          placeholder="Brief description"
          multiline
          numberOfLines={3}
        />
      )}

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Inuk child?</Text>
        <Switch value={isInuk} onValueChange={setIsInuk} />
      </View>

      <Input
        label="Languages Spoken at Home (comma-separated)"
        value={languages}
        onChangeText={setLanguages}
        placeholder="English, French"
      />

      <Button title="Save Child" onPress={handleSubmit} loading={loading} style={styles.primary} />
      <Button
        title="Cancel"
        onPress={() => navigation.navigate('ParentDashboard')}
        variant="outline"
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
  },
  primary: {
    marginTop: 8,
    marginBottom: 12,
  },
});
