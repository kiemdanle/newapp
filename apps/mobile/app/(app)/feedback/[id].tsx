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
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { FeedbackAttachmentImage } from './components/FeedbackAttachmentImage';
import { FeedbackMessageBubble } from './components/FeedbackMessageBubble';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/theme/useTheme';
import { Screen } from '@/components/Screen';
import { fetchFeedbackTicketDetail, sendFeedbackReply } from '@/api/feedback';
import { apiUrl } from '@/api/client';
import type { AppNavigationProp, AppStackParamList } from '@/navigation/AppNavigator';
import type { FeedbackMessage, FeedbackAttachment } from '@expyrico/shared';

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateStr} · ${timeStr}`;
}

function statusColors(status: string, theme: ReturnType<typeof useTheme>) {
  switch (status) {
    case 'open':
      return { bg: theme.colors.primaryLight, text: theme.colors.primaryDark, border: theme.colors.primary + '40', label: 'Open' };
    case 'in_progress':
      return { bg: theme.colors.accentLight, text: theme.colors.accent, border: theme.colors.accent + '40', label: 'In Progress' };
    case 'replied':
      return { bg: theme.colors.primaryLight, text: theme.colors.primaryDark, border: theme.colors.primary + '50', label: 'Support Replied' };
    case 'resolved':
      return { bg: theme.colors.primaryLight, text: theme.colors.primaryDark, border: theme.colors.primary + '60', label: 'Resolved' };
    case 'closed':
    default:
      return { bg: theme.colors.border, text: theme.colors.textMuted, border: theme.colors.border, label: 'Closed' };
  }
}

export default function FeedbackDetailScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'FeedbackDetail'>>();
  const navigation = useNavigation<AppNavigationProp>();
  const queryClient = useQueryClient();
  const theme = useTheme();

  const ticketId = route.params.id;
  const [replyText, setReplyText] = useState('');

  const ticketQuery = useQuery({
    queryKey: ['feedback-ticket', ticketId],
    queryFn: () => fetchFeedbackTicketDetail(ticketId),
  });

  const replyMutation = useMutation({
    mutationFn: (msg: string) => sendFeedbackReply(ticketId, msg),
    onSuccess: () => {
      setReplyText('');
      void queryClient.invalidateQueries({ queryKey: ['feedback-ticket', ticketId] });
      void queryClient.invalidateQueries({ queryKey: ['my-feedback-tickets'] });
    },
    onError: (err) => {
      Alert.alert('Reply Failed', (err as Error).message || 'Could not send reply.');
    },
  });

  const ticket = ticketQuery.data;
  const isClosed = ticket?.status === 'closed' || ticket?.status === 'resolved';

  async function handleSendReply() {
    if (!replyText.trim() || replyMutation.isPending) return;
    replyMutation.mutate(replyText.trim());
  }

  if (ticketQuery.isLoading) {
    return (
      <Screen contentContainerStyle={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>Loading ticket details…</Text>
      </Screen>
    );
  }

  if (ticketQuery.isError || !ticket) {
    return (
      <Screen contentContainerStyle={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.colors.accent} />
        <Text style={[styles.errorTitle, { color: theme.colors.text }]}>Ticket Not Found</Text>
        <Text style={[styles.errorText, { color: theme.colors.textMuted }]}>
          This ticket could not be loaded or may belong to another account.
        </Text>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: theme.colors.primaryLight }]}
        >
          <Text style={[styles.backBtnText, { color: theme.colors.primaryDark }]}>Go back</Text>
        </Pressable>
      </Screen>
    );
  }

  const st = statusColors(ticket.status, theme);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      style={styles.keyboardContainer}
    >
      <Screen contentContainerStyle={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header Card */}
          <View style={[styles.headerCard, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}>
            <View style={styles.badgeRow}>
              {(() => {
                const isBug = ticket.type === 'bug';
                const isIdea = ticket.type === 'suggestion';
                const badgeBg = isBug
                  ? theme.colors.danger + '18'
                  : isIdea
                  ? theme.colors.accent + '18'
                  : theme.colors.primary + '18';
                const badgeColor = isBug
                  ? theme.colors.danger
                  : isIdea
                  ? theme.colors.accent
                  : theme.colors.primary;
                const badgeLabel = isBug ? 'BUG REPORT' : isIdea ? 'SUGGESTION' : 'FEEDBACK';

                return (
                  <View style={[styles.typeBadge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.typeText, { color: badgeColor }]}>{badgeLabel}</Text>
                  </View>
                );
              })()}
              <View style={[styles.statusPill, { backgroundColor: st.bg, borderColor: st.border, borderWidth: 1 }]}>
                <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
              </View>
            </View>

            <Text style={[styles.title, { color: theme.colors.text }]}>{ticket.title}</Text>
            <Text style={[styles.timestamp, { color: theme.colors.textMuted }]}>
              Submitted {formatDateTime(ticket.createdAt)}
            </Text>

            {ticket.deviceInfo && (
              <View style={[styles.deviceRow, { backgroundColor: theme.colors.border + '35' }]}>
                <Ionicons name="phone-portrait-outline" size={13} color={theme.colors.textMuted} />
                <Text style={[styles.deviceText, { color: theme.colors.textMuted }]}>
                  {ticket.deviceInfo.platform?.toUpperCase()} {ticket.deviceInfo.osVersion}
                  {ticket.deviceInfo.deviceModel ? ` • ${ticket.deviceInfo.deviceModel}` : ''}
                </Text>
              </View>
            )}
          </View>

          {/* Attachments Section */}
          {ticket.attachments && ticket.attachments.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
                ATTACHED FILES ({ticket.attachments.length})
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachmentScroll}>
                {ticket.attachments.map((att: FeedbackAttachment, idx: number) => {
                  const isImg = att.mimeType.startsWith('image/');
                  const label = att.fileName.includes('-') && att.fileName.length > 20
                    ? `Photo ${idx + 1}`
                    : att.fileName;
                  return (
                    <Pressable
                      key={att.id}
                      onPress={() => {
                        Alert.alert(label, `Size: ${(att.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`);
                      }}
                      style={[styles.attachmentCard, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}
                    >
                      {isImg ? (
                        <FeedbackAttachmentImage attachmentId={att.id} style={styles.attachmentImg} />
                      ) : (
                        <Ionicons name="document-text-outline" size={28} color={theme.colors.primary} />
                      )}
                      <Text style={[styles.attachmentName, { color: theme.colors.text }]} numberOfLines={1}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Conversation Messages */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
              CONVERSATION ({ticket.messages?.length ?? 0})
            </Text>

            <View style={styles.messagesList}>
              {ticket.messages?.map((msg: FeedbackMessage, idx: number) => (
                <FeedbackMessageBubble
                  key={msg.id}
                  message={msg}
                  isInitial={idx === 0}
                  userName="You"
                />
              ))}
            </View>
          </View>

          {/* Closed Banner */}
          {isClosed && (
            <View style={[styles.closedBanner, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
              <View style={styles.closedTextWrap}>
                <Text style={[styles.closedTitle, { color: theme.colors.text }]}>Case Resolved</Text>
                <Text style={[styles.closedSubtitle, { color: theme.colors.textMuted }]}>
                  {ticket.resolutionNotes || 'This ticket has been marked as resolved. If you experience further issues, please submit a new ticket.'}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* User Reply Composer (Only active if not closed) */}
        {!isClosed && (
          <View style={[styles.composerBar, { backgroundColor: theme.colors.bgElevated, borderTopColor: theme.colors.border }]}>
            <TextInput
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Type your response to support..."
              placeholderTextColor={theme.colors.textMuted}
              selectionColor={theme.colors.primary}
              style={[
                styles.composerInput,
                {
                  backgroundColor: theme.colors.bg,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
              multiline
            />
            <Pressable
              disabled={!replyText.trim() || replyMutation.isPending}
              onPress={handleSendReply}
              style={({ pressed }) => [
                styles.sendBtn,
                {
                  backgroundColor: replyText.trim() ? theme.colors.primary : theme.colors.border,
                  opacity: pressed && replyText.trim() ? 0.85 : 1,
                },
              ]}
            >
              {replyMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="arrow-up" size={18} color={replyText.trim() ? '#FFFFFF' : theme.colors.textMuted} />
              )}
            </Pressable>
          </View>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  backBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  headerCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 6,
  },
  timestamp: {
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  deviceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  attachmentScroll: {
    flexDirection: 'row',
  },
  attachmentCard: {
    width: 90,
    height: 90,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 10,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  attachmentImg: {
    width: '100%',
    height: 60,
    borderRadius: 8,
    marginBottom: 4,
  },
  attachmentName: {
    fontSize: 9,
    textAlign: 'center',
  },
  messagesList: {
    gap: 10,
  },
  messageBubble: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  adminBubble: {
    borderLeftWidth: 4,
  },
  userBubble: {},
  bubbleTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  senderText: {
    fontSize: 12,
  },
  timeText: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  closedBanner: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 20,
  },
  closedTextWrap: {
    flex: 1,
  },
  closedTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  closedSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  composerInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 9,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
