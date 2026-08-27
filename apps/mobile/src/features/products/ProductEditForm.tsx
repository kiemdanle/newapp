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

interface Fields {
  name: string;
  description: string;
  brand: string;
  category: string;
}

function fieldsFrom(edit: ProductEditRow): Fields {
  return {
    name: edit.name,
    description: edit.description ?? '',
    brand: edit.brand ?? '',
    category: edit.category ?? '',
  };
}

function fieldsEqual(a: Fields, b: Fields): boolean {
  return a.name === b.name && a.description === b.description && a.brand === b.brand && a.category === b.category;
}

export interface ProductEditFormProps {
  initialEdit: ProductEditRow;
  /** The live product's current published values — rendered as a small
   * "Live: …" caption under any field the proposal actually changes, so the
   * creator can see the live-vs-proposed boundary plan.md requires without a
   * full diff view. */
  liveProduct: Pick<Product, 'name' | 'description' | 'brand' | 'category'>;
  /** Omitted (with `readOnly`) for a `pending` revision — there is nothing
   * to save until an admin resolves it, so no coordinator is created for
   * that view. */
  coordinator?: DraftMutationCoordinator<ProductEditRow>;
  onDirtyChange?: (dirty: boolean) => void;
  readOnly?: boolean;
}

function LiveCaption({ live, proposed }: { live: string | null; proposed: string }) {
  const theme = useTheme();
  const liveText = live ?? '—';
  if (liveText === (proposed || '—')) return null;
  return <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>Live: {liveText}</Text>;
}

export function ProductEditForm({ initialEdit, liveProduct, coordinator, onDirtyChange, readOnly }: ProductEditFormProps) {
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
              onChangeText={(v) => setFields((f) => ({ ...f, name: v }))}
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
              onChangeText={(v) => setFields((f) => ({ ...f, description: v }))}
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
                onChangeText={(v) => setFields((f) => ({ ...f, brand: v }))}
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
                onChangeText={(v) => setFields((f) => ({ ...f, category: v }))}
              />
            </View>
            <LiveCaption live={liveProduct.category} proposed={fields.category} />
          </View>
        </View>

        {error ? <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text> : null}

        {conflict ? (
          <DraftConflictBanner
            currentVersion={conflict.currentVersion}
            mode="coordinator"
            busy={reconciling}
            onRetry={() => reconcile('retry')}
            onDiscard={() => reconcile('discard-local')}
          />
        ) : null}

        {!readOnly ? (
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
