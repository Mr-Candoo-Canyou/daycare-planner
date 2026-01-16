import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Switch, Pressable } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import api from '../api/client';
import { Child, Daycare } from '../types';

export const NewApplicationScreen = ({ navigation }: any) => {
  const [children, setChildren] = useState<Child[]>([]);
  const [daycares, setDaycares] = useState<Daycare[]>([]);
  const [childId, setChildId] = useState('');
  const [desiredStartDate, setDesiredStartDate] = useState('');
  const [notes, setNotes] = useState('');
  const [optInParentNetwork, setOptInParentNetwork] = useState(false);
  const [desiredArea, setDesiredArea] = useState('');
  const [selectedDaycareIds, setSelectedDaycareIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [childrenRes, daycareRes] = await Promise.all([
          api.get<{ children: Child[] }>('/children'),
          api.get<{ daycares: Daycare[] }>('/daycares'),
        ]);
        setChildren(childrenRes.data.children);
        setDaycares(daycareRes.data.daycares);
        if (childrenRes.data.children.length > 0) {
          setChildId(childrenRes.data.children[0].id);
        }
      } catch (error: any) {
        Alert.alert('Error', error.response?.data?.error || 'Failed to load data.');
      }
    };
    loadData();
  }, []);

  const toggleDaycare = (id: string) => {
    setSelectedDaycareIds((current) => {
      if (current.includes(id)) {
        return current.filter((value) => value !== id);
      }
      return [...current, id];
    });
  };

  const moveChoice = (id: string, direction: 'up' | 'down') => {
    setSelectedDaycareIds((current) => {
      const index = current.indexOf(id);
      if (index === -1) return current;
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= current.length) return current;
      const updated = [...current];
      updated.splice(index, 1);
      updated.splice(newIndex, 0, id);
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!childId || !desiredStartDate || selectedDaycareIds.length === 0) {
      Alert.alert('Missing Info', 'Select a child, start date, and at least one daycare.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/applications', {
        childId,
        desiredStartDate,
        notes,
        optInParentNetwork,
        desiredArea: optInParentNetwork ? desiredArea : null,
        daycareChoices: selectedDaycareIds.map((id) => ({ daycareId: id })),
      });
      Alert.alert('Success', 'Application submitted.');
      navigation.navigate('ParentDashboard');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to submit application.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>New Application</Text>
      <Text style={styles.subtitle}>Create a ranked list of daycares for your child.</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Child</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={childId}
            onValueChange={(value) => setChildId(value)}
            style={styles.picker}
          >
            {children.map((child) => (
              <Picker.Item
                key={child.id}
                label={`${child.first_name} ${child.last_name}`}
                value={child.id}
              />
            ))}
          </Picker>
        </View>
      </View>

      <Input
        label="Desired Start Date (YYYY-MM-DD)"
        value={desiredStartDate}
        onChangeText={setDesiredStartDate}
        placeholder="2025-01-15"
      />

      <Input
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Anything we should know?"
        multiline
        numberOfLines={3}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Opt into parent network?</Text>
        <Switch value={optInParentNetwork} onValueChange={setOptInParentNetwork} />
      </View>

      {optInParentNetwork && (
        <Input
          label="Desired Area (optional)"
          value={desiredArea}
          onChangeText={setDesiredArea}
          placeholder="Downtown, East Side"
        />
      )}

      <View style={styles.section}>
        <Text style={styles.label}>Ranked Daycare Choices</Text>
        <Text style={styles.helper}>Tap to select. Use arrows to reorder.</Text>
        {daycares.map((daycare) => {
          const selected = selectedDaycareIds.includes(daycare.id);
          return (
            <Pressable
              key={daycare.id}
              style={[styles.choiceRow, selected && styles.choiceSelected]}
              onPress={() => toggleDaycare(daycare.id)}
            >
              <View style={styles.choiceInfo}>
                <Text style={styles.choiceName}>{daycare.name}</Text>
                <Text style={styles.choiceMeta}>
                  {daycare.city}, {daycare.province} · {daycare.current_enrollment}/{daycare.capacity}
                </Text>
              </View>
              {selected && (
                <View style={styles.rankControls}>
                  <Button
                    title="↑"
                    onPress={() => moveChoice(daycare.id, 'up')}
                    variant="outline"
                    style={styles.rankButton}
                  />
                  <Button
                    title="↓"
                    onPress={() => moveChoice(daycare.id, 'down')}
                    variant="outline"
                    style={styles.rankButton}
                  />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {selectedDaycareIds.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.label}>Current Ranking</Text>
          {selectedDaycareIds.map((id, index) => {
            const daycare = daycares.find((d) => d.id === id);
            if (!daycare) return null;
            return (
              <Text key={id} style={styles.rankLine}>
                {index + 1}. {daycare.name}
              </Text>
            );
          })}
        </View>
      )}

      <Button title="Submit Application" onPress={handleSubmit} loading={loading} style={styles.primary} />
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
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  helper: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
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
  choiceRow: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#fff',
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  choiceSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  choiceInfo: {
    flex: 1,
    marginRight: 12,
  },
  choiceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  choiceMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  rankControls: {
    flexDirection: 'row',
  },
  rankButton: {
    minHeight: 32,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginLeft: 6,
  },
  rankLine: {
    fontSize: 14,
    color: '#1e293b',
    marginBottom: 4,
  },
  primary: {
    marginTop: 8,
    marginBottom: 12,
  },
});
