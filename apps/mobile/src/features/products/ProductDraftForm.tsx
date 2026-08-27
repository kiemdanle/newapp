import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Product } from '@expyrico/shared';
import { isApiError } from '../../api/errors';
import { usePatchDraft } from '../../api/products';
import { apiClient } from '../../api/client';
import type { DraftMutationCoordinator } from './draft-mutation-coordinator';
import { DraftConflictBanner } from './DraftConflictBanner';
import { useTheme } from '../../theme/useTheme';
import { Button } from '../../components/Button';
const NAME_MAX = 200;
const DESCRIPTION_MAX = 2000;

interface Fields {
  name: string;
  description: string;
  brand: string;
  category: string;
}

function fieldsFrom(product: Product): Fields {
  return {
    name: product.name,
    description: product.description ?? '',
    brand: product.brand ?? '',
    category: product.category ?? '',
  };
}

function fieldsEqual(a: Fields, b: Fields): boolean {
  return a.name === b.name && a.description === b.description && a.brand === b.brand && a.category === b.category;
}

export interface ProductDraftFormProps {
  initialProduct: Product;
  onSaved?: (product: Product) => void;
  onDirtyChange?: (dirty: boolean) => void;
  readOnly?: boolean;
  hideSaveButton?: boolean;
  /** Rendered above the fields — used by the drafts screen to surface
   * `moderationFeedback` for a `changes_required` row. */
  feedbackBanner?: React.ReactNode;
  /** When provided, metadata saves route through the same serialized queue
   * as the photo editor mounted alongside this form (Task 7) instead of
   * issuing an independent PATCH — required so the two never race for the
   * same product `version`. Omitted for the read-only pending view, which
   * never saves at all. */
  coordinator?: DraftMutationCoordinator<Product>;
}

/** The identifier (barcode/QR) is immutable and shown read-only — it's the
 * one field this form never lets the creator change, since it's the key the
 * whole draft/resume flow is keyed by. */
export function ProductDraftForm({ initialProduct, onSaved, onDirtyChange, readOnly, hideSaveButton, feedbackBanner, coordinator }: ProductDraftFormProps) {
  const theme = useTheme();
  const patchDraft = usePatchDraft();
  const [known, setKnown] = useState(initialProduct);
  const [fields, setFields] = useState<Fields>(() => fieldsFrom(initialProduct));
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ currentVersion: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const dirty = !fieldsEqual(fields, fieldsFrom(known));

  useEffect(() => {
    onDirtyChange?.(dirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  const enqueuePatch = (updatedFields: Fields) => {
    if (!coordinator || readOnly) return;
    const patch = {
      name: updatedFields.name.trim(),
      description: updatedFields.description.trim() || null,
      brand: updatedFields.brand.trim() || null,
      category: updatedFields.category.trim() || null,
    };
    void coordinator.enqueue({ kind: 'metadata', fields: patch }).then((upd) => {
      setKnown(upd);
    }).catch(() => {});
  };

  // Coordinator conflicts arrive asynchronously (a photo mutation can also
  // trigger one) — subscribe rather than only checking after this form's own
  // save, so a conflict raised elsewhere still surfaces here.
  useEffect(() => {
    if (!coordinator) return;
    if (coordinator.hasConflict()) setConflict({ currentVersion: known.version });
    return coordinator.onConflict((info) => {
      setKnown(info.serverEntity);
      setConflict({ currentVersion: info.currentVersion });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinator]);

  const save = async () => {
    if (!fields.name.trim()) {
      setError('Name is required');
      return;
    }
    setError(null);
    setConflict(null);
    const patch = {
      name: fields.name.trim(),
      description: fields.description.trim() || null,
      brand: fields.brand.trim() || null,
      category: fields.category.trim() || null,
    };
    setSaving(true);
    try {
      const updated = coordinator
        ? await coordinator.enqueue({ kind: 'metadata', fields: patch })
        : await patchDraft.mutateAsync({ id: known.id, version: known.version, ...patch });
      setKnown(updated);
      setFields(fieldsFrom(updated));
      onSaved?.(updated);
    } catch (e) {
      if (isApiError(e) && e.code === 'version_conflict') {
        // Never overwrite what the creator typed — only surface the conflict
        // and let them explicitly choose to refresh.
        setConflict({ currentVersion: e.currentVersion ?? known.version });
        return;
      }
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Non-coordinator path only: a plain refetch that preserves dirty text —
  // the coordinator path below uses reconcileConflict() instead, which also
  // resolves the save() promise still pending from the conflicting attempt.
  const refreshFromServer = async () => {
    setRefreshing(true);
    try {
      const fresh = await apiClient.get<Product>(`/products/${known.id}`);
      setKnown(fresh);
      setConflict(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const reconcile = async (resolution: 'retry' | 'discard-local') => {
    if (!coordinator) return;
    setRefreshing(true);
    try {
      const resolved = await coordinator.reconcileConflict(resolution);
      setKnown(resolved);
      if (resolution === 'discard-local') setFields(fieldsFrom(resolved));
      setConflict(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const isSaving = coordinator ? saving : patchDraft.isPending;

  const isIdentifierQr = Boolean(known.qrPayload);
  const identifierValue = known.barcode ?? known.qrPayload ?? '—';

  return (
    <View style={styles.formContainer}>
      {feedbackBanner}

      {/* Read-Only Identifier Card */}
      <View
        style={[
          styles.identifierCard,
          {
            backgroundColor: theme.colors.bgElevated,
            borderColor: '#DCDED9',
            borderRadius: theme.radii.lg,
          },
        ]}
      >
        <View style={styles.identifierLeft}>
          <View style={[styles.identifierIconWrap, { backgroundColor: theme.colors.primaryLight }]}>
            <Ionicons
              name={isIdentifierQr ? 'qr-code-outline' : 'barcode-outline'}
              size={22}
              color={theme.colors.primaryDark}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabelMicro, { color: theme.colors.textMuted }]}>
              {isIdentifierQr ? 'SCANNED QR CODE' : 'SCANNED BARCODE'}
            </Text>
            <Text
              testID="draft-identifier"
              style={[styles.identifierText, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {identifierValue}
            </Text>
          </View>
        </View>
        <View style={[styles.verifiedPill, { backgroundColor: theme.colors.primaryLight }]}>
          <Text style={[styles.verifiedPillText, { color: theme.colors.primaryDark }]}>Verified</Text>
        </View>
      </View>

      {/* Form Fields Card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: '#FFFFFF',
            borderColor: '#E2E2DE',
            borderRadius: theme.radii.lg,
          },
        ]}
      >
        {/* Product Name Field */}
        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Ionicons name="pricetag-outline" size={15} color={theme.colors.primary} />
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Product Name *</Text>
          </View>
          <View
            style={[
              styles.inputBox,
              {
                backgroundColor: focusedField === 'name' ? '#FFFFFF' : '#F9FAF9',
                borderColor: focusedField === 'name' ? theme.colors.primary : '#DCDED9',
                borderRadius: theme.radii.md,
              },
            ]}
          >
            <TextInput
              accessibilityLabel="Name"
              testID="draft-name"
              editable={!readOnly}
              placeholder="e.g. Organic Almond Milk"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.textInput, { color: theme.colors.text }]}
              value={fields.name}
              maxLength={NAME_MAX}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
              onChangeText={(v) => {
                const next = { ...fields, name: v };
                setFields(next);
                enqueuePatch(next);
              }}
            />
          </View>
        </View>

        {/* Description Field */}
        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Ionicons name="document-text-outline" size={15} color={theme.colors.primary} />
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Description (optional)</Text>
          </View>
          <View
            style={[
              styles.inputBox,
              styles.multilineBox,
              {
                backgroundColor: focusedField === 'description' ? '#FFFFFF' : '#F9FAF9',
                borderColor: focusedField === 'description' ? theme.colors.primary : '#DCDED9',
                borderRadius: theme.radii.md,
              },
            ]}
          >
            <TextInput
              accessibilityLabel="Description"
              testID="draft-description"
              editable={!readOnly}
              placeholder="Ingredients, taste profile, or key packaging notes…"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.textInput, styles.multilineInput, { color: theme.colors.text }]}
              value={fields.description}
              maxLength={DESCRIPTION_MAX}
              multiline
              onFocus={() => setFocusedField('description')}
              onBlur={() => setFocusedField(null)}
              onChangeText={(v) => {
                const next = { ...fields, description: v };
                setFields(next);
                enqueuePatch(next);
              }}
            />
            <Text testID="draft-description-counter" style={[styles.charCounter, { color: theme.colors.textMuted }]}>
              {fields.description.length}/{DESCRIPTION_MAX}
            </Text>
          </View>
        </View>

        {/* 2-Column Row for Brand & Category */}
        <View style={styles.twoColRow}>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <View style={styles.labelRow}>
              <Ionicons name="business-outline" size={14} color={theme.colors.primary} />
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Brand</Text>
            </View>
            <View
              style={[
                styles.inputBox,
                {
                  backgroundColor: focusedField === 'brand' ? '#FFFFFF' : '#F9FAF9',
                  borderColor: focusedField === 'brand' ? theme.colors.primary : '#DCDED9',
                  borderRadius: theme.radii.md,
                },
              ]}
            >
              <TextInput
                accessibilityLabel="Brand"
                testID="draft-brand"
                editable={!readOnly}
                placeholder="e.g. Silk"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.textInput, { color: theme.colors.text }]}
                value={fields.brand}
                onFocus={() => setFocusedField('brand')}
                onBlur={() => setFocusedField(null)}
                onChangeText={(v) => {
                  const next = { ...fields, brand: v };
                  setFields(next);
                  enqueuePatch(next);
                }}
              />
            </View>
          </View>

          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <View style={styles.labelRow}>
              <Ionicons name="grid-outline" size={14} color={theme.colors.primary} />
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Category</Text>
            </View>
            <View
              style={[
                styles.inputBox,
                {
                  backgroundColor: focusedField === 'category' ? '#FFFFFF' : '#F9FAF9',
                  borderColor: focusedField === 'category' ? theme.colors.primary : '#DCDED9',
                  borderRadius: theme.radii.md,
                },
              ]}
            >
              <TextInput
                accessibilityLabel="Category"
                testID="draft-category"
                editable={!readOnly}
                placeholder="e.g. Dairy"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.textInput, { color: theme.colors.text }]}
                value={fields.category}
                onFocus={() => setFocusedField('category')}
                onBlur={() => setFocusedField(null)}
                onChangeText={(v) => {
                  const next = { ...fields, category: v };
                  setFields(next);
                  enqueuePatch(next);
                }}
              />
            </View>
          </View>
        </View>
        {error ? <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text> : null}

        {conflict ? (
          <DraftConflictBanner
            currentVersion={conflict.currentVersion}
            mode={coordinator ? 'coordinator' : 'refresh-only'}
            busy={refreshing}
            onRetry={coordinator ? () => reconcile('retry') : refreshFromServer}
            onDiscard={coordinator ? () => reconcile('discard-local') : undefined}
          />
        ) : null}

        {!readOnly && !hideSaveButton ? (
          <Button
            testID="draft-save"
            label={isSaving ? 'Saving Changes…' : 'Save Details'}
            loading={isSaving}
            disabled={!dirty || Boolean(conflict)}
            onPress={save}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    gap: 14,
  },
  identifierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    padding: 14,
  },
  identifierLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  identifierIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabelMicro: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  identifierText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  verifiedPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  verifiedPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1.5,
    padding: 18,
    gap: 16,
    shadowColor: '#2C2C28',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  fieldGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  inputBox: {
    borderWidth: 1.5,
    paddingHorizontal: 14,
    minHeight: 50,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 16,
    paddingVertical: 10,
  },
  multilineBox: {
    minHeight: 100,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  multilineInput: {
    minHeight: 68,
    textAlignVertical: 'top',
    paddingVertical: 0,
  },
  charCounter: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
