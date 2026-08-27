import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Product, ProductEditRow } from '@expyrico/shared';
import type { DraftMutationCoordinator } from './draft-mutation-coordinator';
import { DraftConflictBanner } from './DraftConflictBanner';
import { useTheme } from '../../theme/useTheme';
import { Button } from '../../components/Button';
const NAME_MAX = 200;
const DESCRIPTION_MAX = 2000;
const NOTES_MAX = 1000;

interface Fields {
  name: string;
  description: string;
  brand: string;
  category: string;
  defaultShelfLifeDays: string;
  notes: string;
}

function fieldsFrom(edit: ProductEditRow): Fields {
  return {
    name: edit.name,
    description: edit.description ?? '',
    brand: edit.brand ?? '',
    category: edit.category ?? '',
    defaultShelfLifeDays: edit.defaultShelfLifeDays != null ? String(edit.defaultShelfLifeDays) : '',
    notes: edit.notes ?? '',
  };
}

function fieldsEqual(a: Fields, b: Fields): boolean {
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.brand === b.brand &&
    a.category === b.category &&
    a.defaultShelfLifeDays === b.defaultShelfLifeDays &&
    a.notes === b.notes
  );
}

export interface ProductEditFormProps {
  initialEdit: ProductEditRow;
  /** The live product's current published values — rendered as a small
   * "Live: …" caption under any field the proposal actually changes, so the
   * creator can see the live-vs-proposed boundary plan.md requires without a
   * full diff view. */
  liveProduct: Pick<Product, 'name' | 'description' | 'brand' | 'category'> & {
    defaultShelfLifeDays?: number | null;
  };
  /** Omitted (with `readOnly`) for a `pending` revision — there is nothing
   * to save until an admin resolves it, so no coordinator is created for
   * that view. */
  coordinator?: DraftMutationCoordinator<ProductEditRow>;
  onDirtyChange?: (dirty: boolean) => void;
  readOnly?: boolean;
  hideSaveButton?: boolean;
}

function LiveCaption({ live, proposed }: { live: string | null; proposed: string }) {
  const theme = useTheme();
  const liveText = live ?? '—';
  if (liveText === (proposed || '—')) return null;
  return <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>Live: {liveText}</Text>;
}

export function ProductEditForm({ initialEdit, liveProduct, coordinator, onDirtyChange, readOnly, hideSaveButton }: ProductEditFormProps) {
  const theme = useTheme();
  const [known, setKnown] = useState(initialEdit);
  const [fields, setFields] = useState<Fields>(() => fieldsFrom(initialEdit));
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ currentVersion: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const dirty = !fieldsEqual(fields, fieldsFrom(known));

  useEffect(() => {
    onDirtyChange?.(dirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  const enqueuePatch = (updatedFields: Fields) => {
    if (!coordinator || readOnly) return;
    if (!updatedFields.name.trim()) return;
    const trimmedShelf = updatedFields.defaultShelfLifeDays.trim();
    let parsedShelf: number | null = null;
    if (trimmedShelf) {
      if (!/^\d+$/.test(trimmedShelf)) return;
      const num = parseInt(trimmedShelf, 10);
      if (isNaN(num) || num < 1 || num > 3650) return;
      parsedShelf = num;
    }
    const patch = {
      name: updatedFields.name.trim(),
      description: updatedFields.description.trim() || null,
      brand: updatedFields.brand.trim() || null,
      category: updatedFields.category.trim() || null,
      defaultShelfLifeDays: parsedShelf,
      notes: updatedFields.notes.trim() || null,
    };
    try {
      void coordinator.enqueue({ kind: 'metadata', fields: patch });
    } catch {}
  };
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
    if (!coordinator) return;
    if (!fields.name.trim()) {
      setError('Name is required');
      return;
    }
    const trimmedShelf = fields.defaultShelfLifeDays.trim();
    let parsedShelf: number | null = null;
    if (trimmedShelf) {
      const num = parseInt(trimmedShelf, 10);
      if (isNaN(num) || !/^\d+$/.test(trimmedShelf) || num < 1 || num > 3650) {
        setError('Default shelf life must be a whole number between 1 and 3650 days');
        return;
      }
      parsedShelf = num;
    }
    const trimmedNotes = fields.notes.trim();
    if (trimmedNotes.length > NOTES_MAX) {
      setError(`Reason / note to moderators must be ${NOTES_MAX} characters or fewer`);
      return;
    }
    setError(null);
    setConflict(null);
    setSaving(true);
    try {
      const updated = await coordinator.enqueue({
        kind: 'metadata',
        fields: {
          name: fields.name.trim(),
          description: fields.description.trim() || null,
          brand: fields.brand.trim() || null,
          category: fields.category.trim() || null,
          defaultShelfLifeDays: parsedShelf,
          notes: trimmedNotes || null,
        },
      });
      setKnown(updated);
      setFields(fieldsFrom(updated));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const reconcile = async (resolution: 'retry' | 'discard-local') => {
    if (!coordinator) return;
    setReconciling(true);
    try {
      const resolved = await coordinator.reconcileConflict(resolution);
      setKnown(resolved);
      if (resolution === 'discard-local') setFields(fieldsFrom(resolved));
      setConflict(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReconciling(false);
    }
  };

  return (
    <View style={styles.formContainer}>
      {known.status === 'changes_required' && known.moderationFeedback ? (
        <View
          testID="edit-feedback"
          style={[
            styles.feedbackCard,
            { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border, borderRadius: theme.radii.md },
          ]}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Changes requested</Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>{known.moderationFeedback}</Text>
        </View>
      ) : null}

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
        {/* Name Field */}
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
              testID="edit-name"
              editable={!readOnly}
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
          <LiveCaption live={liveProduct.name} proposed={fields.name} />
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
              testID="edit-description"
              editable={!readOnly}
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
            <Text testID="edit-description-counter" style={[styles.charCounter, { color: theme.colors.textMuted }]}>
              {fields.description.length}/{DESCRIPTION_MAX}
            </Text>
          </View>
          <LiveCaption live={liveProduct.description} proposed={fields.description} />
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
                testID="edit-brand"
                editable={!readOnly}
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
            <LiveCaption live={liveProduct.brand} proposed={fields.brand} />
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
                testID="edit-category"
                editable={!readOnly}
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
            <LiveCaption live={liveProduct.category} proposed={fields.category} />
          </View>
        </View>
        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Ionicons name="time-outline" size={15} color={theme.colors.primary} />
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Default Shelf Life (Days)</Text>
          </View>
          <View
            style={[
              styles.inputBox,
              {
                backgroundColor: focusedField === 'defaultShelfLifeDays' ? '#FFFFFF' : '#F9FAF9',
                borderColor: focusedField === 'defaultShelfLifeDays' ? theme.colors.primary : '#DCDED9',
                borderRadius: theme.radii.md,
              },
            ]}
          >
            <TextInput
              accessibilityLabel="Default Shelf Life"
              testID="edit-shelf-life"
              editable={!readOnly}
              keyboardType="numeric"
              placeholder="e.g. 30"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.textInput, { color: theme.colors.text }]}
              value={fields.defaultShelfLifeDays}
              onFocus={() => setFocusedField('defaultShelfLifeDays')}
              onBlur={() => setFocusedField(null)}
              onChangeText={(v) => {
                const sanitized = v.replace(/[^0-9]/g, '');
                const next = { ...fields, defaultShelfLifeDays: sanitized };
                setFields(next);
                enqueuePatch(next);
              }}
            />
          </View>
          <LiveCaption
            live={liveProduct.defaultShelfLifeDays ? `${liveProduct.defaultShelfLifeDays} days` : null}
            proposed={fields.defaultShelfLifeDays ? `${fields.defaultShelfLifeDays} days` : ''}
          />
        </View>

        {/* Submitter Notes / Reason for Suggestion Field */}
        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Ionicons name="chatbox-ellipses-outline" size={15} color={theme.colors.primary} />
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Reason for Suggestion / Note to Moderators</Text>
          </View>
          <View
            style={[
              styles.inputBox,
              styles.multilineBox,
              {
                backgroundColor: focusedField === 'notes' ? '#FFFFFF' : '#F9FAF9',
                borderColor: focusedField === 'notes' ? theme.colors.primary : '#DCDED9',
                borderRadius: theme.radii.md,
              },
            ]}
          >
            <TextInput
              accessibilityLabel="Reason for edit"
              testID="edit-notes"
              editable={!readOnly}
              placeholder="e.g. The shelf life on the packaging label states 14 days, not 30 days"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.textInput, styles.multilineInput, { color: theme.colors.text }]}
              value={fields.notes}
              maxLength={NOTES_MAX}
              multiline
              onFocus={() => setFocusedField('notes')}
              onBlur={() => setFocusedField(null)}
              onChangeText={(v) => {
                const next = { ...fields, notes: v };
                setFields(next);
                enqueuePatch(next);
              }}
            />
            <Text testID="edit-notes-counter" style={[styles.charCounter, { color: theme.colors.textMuted }]}>
              {fields.notes.length}/{NOTES_MAX}
            </Text>
          </View>
        </View>
        {error ? <Text testID="edit-form-error" style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text> : null}

        {conflict ? (
          <DraftConflictBanner
            currentVersion={conflict.currentVersion}
            mode="coordinator"
            busy={reconciling}
            onRetry={() => reconcile('retry')}
            onDiscard={() => reconcile('discard-local')}
          />
        ) : null}

        {!readOnly && !hideSaveButton ? (
          <Button
            testID="edit-save"
            label={saving ? 'Saving Changes…' : 'Save Proposal'}
            loading={saving}
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
  feedbackCard: {
    borderWidth: 1,
    padding: 14,
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
