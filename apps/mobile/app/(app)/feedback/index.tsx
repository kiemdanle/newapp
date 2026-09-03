import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/theme/useTheme';
import { Screen } from '@/components/Screen';
import { FeedbackTypeSelector } from './components/FeedbackTypeSelector';
import { FeedbackAttachmentPicker } from './components/FeedbackAttachmentPicker';
import { FeedbackTicketCard } from './components/FeedbackTicketCard';
import {
  createFeedbackTicket,
  fetchMyFeedbackTickets,
  uploadFeedbackAttachment,
} from '@/api/feedback';
import type { AppNavigationProp, AppStackParamList } from '@/navigation/AppNavigator';
import type { FeedbackType, FeedbackTicket } from '@expyrico/shared';
import type { PickedPhoto } from '@/features/products/photo-picker-adapter';

type Mode = 'submit' | 'tickets';

export default function FeedbackHubScreen() {
  const navigation = useNavigation<AppNavigationProp>();
  const route = useRoute<RouteProp<AppStackParamList, 'FeedbackHub'>>();
  const queryClient = useQueryClient();
  const theme = useTheme();

  const [mode, setMode] = useState<Mode>(route.params?.initialTab ?? 'submit');
  const [type, setType] = useState<FeedbackType>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // My Tickets Query
  const ticketsQuery = useQuery({
    queryKey: ['my-feedback-tickets'],
    queryFn: () => fetchMyFeedbackTickets(),
    enabled: mode === 'tickets',
  });

  // Ticket Submission
  async function handleSubmit() {
    if (title.trim().length < 3) {
      Alert.alert('Validation Error', 'Title must be at least 3 characters long.');
      return;
    }
    if (description.trim().length < 10) {
      Alert.alert('Validation Error', 'Description must be at least 10 characters long.');
      return;
    }

    setUploading(true);
    setUploadProgress(null);

    try {
      const attachmentIds: string[] = [];

      // 1. Upload photos sequentially if any
      for (let i = 0; i < photos.length; i++) {
        setUploadProgress(`Uploading attachment ${i + 1} of ${photos.length}…`);
        const photo = photos[i]!;
        const handle = uploadFeedbackAttachment({
          path: photo.path,
          mime: photo.mime || 'image/jpeg',
        });
        const att = await handle.promise;
        attachmentIds.push(att.id);
      }

      setUploadProgress('Submitting ticket…');

      // 2. Create ticket
      const ticket = await createFeedbackTicket({
        type,
        title: title.trim(),
        description: description.trim(),
        attachmentIds,
        deviceInfo: {
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          osVersion: String(Platform.Version),
          appVersion: '1.0.0',
        },
      });

      setUploading(false);
      setUploadProgress(null);

      // Reset form
      setTitle('');
      setDescription('');
      setPhotos([]);

      // Invalidate tickets query
      void queryClient.invalidateQueries({ queryKey: ['my-feedback-tickets'] });

      Alert.alert(
        'Submission Received',
        'Thank you! Our support and engineering team has been notified. You can track updates and replies in My Tickets.',
        [
          {
            text: 'View Ticket',
            onPress: () => {
              setMode('tickets');
              navigation.push('FeedbackDetail', { id: ticket.id });
            },
          },
          {
            text: 'Done',
            onPress: () => setMode('tickets'),
          },
        ],
      );
    } catch (err) {
      setUploading(false);
      setUploadProgress(null);
      Alert.alert('Submission Failed', (err as Error).message || 'Could not submit feedback.');
    }
  }

  const isFormValid = title.trim().length >= 3 && description.trim().length >= 10 && !uploading;

  return (
    <Screen contentContainerStyle={styles.screen}>
      {/* Header Segment Switcher */}
      <View style={[styles.segmentedBar, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}>
        <Pressable
          testID="feedback-tab-submit"
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'submit' }}
          onPress={() => setMode('submit')}
          style={[
            styles.segmentBtn,
            mode === 'submit' && {
              backgroundColor: theme.colors.primaryLight,
            },
          ]}
        >
          <Ionicons
            name="create-outline"
            size={16}
            color={mode === 'submit' ? theme.colors.primaryDark : theme.colors.textMuted}
          />
          <Text
            style={[
              styles.segmentText,
              {
                color: mode === 'submit' ? theme.colors.primaryDark : theme.colors.textMuted,
                fontWeight: mode === 'submit' ? '700' : '600',
              },
            ]}
          >
            Submit New
          </Text>
        </Pressable>

        <Pressable
          testID="feedback-tab-tickets"
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'tickets' }}
          onPress={() => setMode('tickets')}
          style={[
            styles.segmentBtn,
            mode === 'tickets' && {
              backgroundColor: theme.colors.primaryLight,
            },
          ]}
        >
          <Ionicons
            name="chatbubbles-outline"
            size={16}
            color={mode === 'tickets' ? theme.colors.primaryDark : theme.colors.textMuted}
          />
          <Text
            style={[
              styles.segmentText,
              {
                color: mode === 'tickets' ? theme.colors.primaryDark : theme.colors.textMuted,
                fontWeight: mode === 'tickets' ? '700' : '600',
              },
            ]}
          >
            My Tickets
          </Text>
        </Pressable>
      </View>

      {/* Mode 1: Submit Form */}
      {mode === 'submit' && (
        <View style={styles.formContainer}>
          <FeedbackTypeSelector value={type} onChange={setType} />

          {/* Title Input */}
          <View style={styles.fieldGroup}>
            <View style={styles.fieldHeader}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textMuted }]}>SUMMARY / TITLE</Text>
              <Text style={[styles.counter, { color: theme.colors.textMuted }]}>{title.length}/120</Text>
            </View>
            <TextInput
              testID="feedback-title-input"
              value={title}
              onChangeText={setTitle}
              maxLength={120}
              placeholder="e.g. Barcode scanner not focusing"
              placeholderTextColor="rgba(140, 140, 133, 0.6)"
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.colors.bgElevated,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
            />
          </View>

          {/* Description Input */}
          <View style={styles.fieldGroup}>
            <View style={styles.fieldHeader}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textMuted }]}>DESCRIPTION</Text>
              <Text style={[styles.counter, { color: theme.colors.textMuted }]}>{description.length}/3000</Text>
            </View>
            <TextInput
              testID="feedback-description-input"
              value={description}
              onChangeText={setDescription}
              maxLength={3000}
              multiline
              numberOfLines={4}
              placeholder="Provide exact details or steps to reproduce so our engineers can resolve it quickly..."
              placeholderTextColor="rgba(140, 140, 133, 0.6)"
              style={[
                styles.textArea,
                {
                  backgroundColor: theme.colors.bgElevated,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
            />
          </View>

          {/* Attachment Picker */}
          <FeedbackAttachmentPicker photos={photos} onChange={setPhotos} />

          {/* Diagnostics Card */}
          <View style={[styles.diagCard, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}>
            <Ionicons name="information-circle-outline" size={16} color={theme.colors.primary} />
            <Text style={[styles.diagText, { color: theme.colors.textMuted }]}>
              Device diagnostics ({Platform.OS.toUpperCase()} {Platform.Version}) will be attached automatically to help diagnose issues.
            </Text>
          </View>

          {/* Submit Button */}
          <Pressable
            testID="feedback-submit-button"
            accessibilityRole="button"
            accessibilityLabel="Submit feedback ticket"
            disabled={!isFormValid}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.submitBtn,
              {
                backgroundColor: isFormValid ? theme.colors.primary : theme.colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            {uploading ? (
              <View style={styles.uploadingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.submitBtnText}>{uploadProgress || 'Submitting…'}</Text>
              </View>
            ) : (
              <Text style={[styles.submitBtnText, { color: isFormValid ? '#FFFFFF' : theme.colors.textMuted }]}>
                Submit Ticket
              </Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Mode 2: My Tickets List */}
      {mode === 'tickets' && (
        <View style={styles.ticketsContainer}>
          {ticketsQuery.isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>Loading your tickets…</Text>
            </View>
          ) : ticketsQuery.data?.items && ticketsQuery.data.items.length > 0 ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={ticketsQuery.isRefetching}
                  onRefresh={() => ticketsQuery.refetch()}
                  colors={[theme.colors.primary]}
                  tintColor={theme.colors.primary}
                />
              }
            >
              {ticketsQuery.data.items.map((ticket: FeedbackTicket) => (
                <FeedbackTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onPress={() => navigation.push('FeedbackDetail', { id: ticket.id })}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyBox}>
              <View style={[styles.emptyIconCircle, { backgroundColor: theme.colors.bgElevated }]}>
                <Ionicons name="chatbox-ellipses-outline" size={32} color={theme.colors.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Submissions Yet</Text>
              <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                You haven't filed any feedback or bug reports yet. Have a suggestion or issue? Submit a ticket above.
              </Text>
              <Pressable
                onPress={() => setMode('submit')}
                style={[styles.emptyBtn, { backgroundColor: theme.colors.primaryLight }]}
              >
                <Text style={[styles.emptyBtnText, { color: theme.colors.primaryDark }]}>File a report</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  segmentedBar: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    marginBottom: 20,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  segmentText: {
    fontSize: 13,
  },
  formContainer: {
    gap: 4,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  counter: {
    fontSize: 11,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  diagCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  diagText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  submitBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ticketsContainer: {
    flex: 1,
  },
  loadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyBox: {
    paddingVertical: 56,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
  emptyBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
  },
  emptyBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
