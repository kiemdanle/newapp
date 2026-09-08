import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/useTheme';
import { formatDate, getCountryMetadata } from '../utils/country-format';
import { detectNaturalDate } from '../utils/naturalDateParser';
import { useSessionStore } from '../auth/session-store';

const ITEM_HEIGHT = 38;
const VISIBLE_ITEMS = 3;
const PADDING_ITEMS = 1; // 1 item padding on top and bottom for 3 visible items

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_NAMES_VN = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

function formatDateForInput(y: number, mZero: number, d: number, format: 'DMY' | 'MDY' | 'YMD'): string {
  const dd = pad2(d);
  const mm = pad2(mZero + 1);
  const yyyy = y.toString();
  if (format === 'DMY') return `${dd}/${mm}/${yyyy}`;
  if (format === 'MDY') return `${mm}/${dd}/${yyyy}`;
  return `${yyyy}-${mm}-${dd}`;
}

const PRESETS = [
  { label: '+3 Days', days: 3 },
  { label: '+1 Week', days: 7 },
  { label: '+3 Months', months: 3 },
];

function getDaysInMonth(year: number, monthZeroIndexed: number): number {
  return new Date(year, monthZeroIndexed + 1, 0).getDate();
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export interface WheelDatePickerModalProps {
  visible: boolean;
  value?: string; // YYYY-MM-DD
  onClose: () => void;
  onConfirm: (dateIso: string) => void;
  title?: string;
}

interface WheelColumnProps<T> {
  items: T[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  renderLabel: (item: T) => string;
  flex?: number;
}

function WheelColumn<T>({ items, selectedIndex, onSelect, renderLabel, flex = 1 }: WheelColumnProps<T>) {
  const theme = useTheme();
  const isDark = theme.scheme === 'dark';
  const scrollRef = useRef<ScrollView>(null);
  const isUserScrolling = useRef(false);

  useEffect(() => {
    if (!isUserScrolling.current) {
      scrollRef.current?.scrollTo({
        y: selectedIndex * ITEM_HEIGHT,
        animated: false,
      });
    }
  }, [selectedIndex]);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isUserScrolling.current = false;
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_HEIGHT)));
    if (index !== selectedIndex) {
      onSelect(index);
    }
  };

  return (
    <View style={[styles.columnContainer, { flex }]}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        nestedScrollEnabled
        contentOffset={{ x: 0, y: selectedIndex * ITEM_HEIGHT }}
        onLayout={() => {
          scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
        }}
        onScrollBeginDrag={() => {
          isUserScrolling.current = true;
        }}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        contentContainerStyle={{
          paddingVertical: PADDING_ITEMS * ITEM_HEIGHT,
        }}
      >
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          const distance = Math.abs(idx - selectedIndex);

          const textColor = isSelected
            ? (isDark ? '#4BAE8A' : '#2C2C28')
            : (isDark ? '#B7BDB7' : '#73736C');
          const opacity = isSelected ? 1 : distance === 1 ? 0.75 : 0.45;
          const fontSize = isSelected ? 16 : 14;
          const fontWeight = isSelected ? '700' : '500';

          return (
            <Pressable
              key={idx}
              accessibilityRole="button"
              accessibilityLabel={`${renderLabel(item)}`}
              onPress={() => {
                onSelect(idx);
                scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: true });
              }}
              style={styles.itemRow}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.itemText,
                  {
                    color: textColor,
                    opacity,
                    fontSize,
                    fontWeight: fontWeight as any,
                  },
                ]}
              >
                {renderLabel(item)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function WheelDatePickerModal({
  visible,
  value,
  onClose,
  onConfirm,
  title = 'Select Expiry Date',
}: WheelDatePickerModalProps) {
  const theme = useTheme();

  const initialDate = useMemo(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parts = value.split('-').map(Number);
      const parsedYear = parts[0] ?? new Date().getFullYear();
      const parsedMonth = (parts[1] ?? 1) - 1;
      const parsedDay = parts[2] ?? 1;
      return { year: parsedYear, month: parsedMonth, day: parsedDay };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }, [value]);
  const userCountry = useSessionStore((s) => s.user?.country ?? null);
  const countryMeta = useMemo(() => getCountryMetadata(userCountry), [userCountry]);
  const dateFormat = countryMeta.dateFormat;

  const [selectedYear, setSelectedYear] = useState(initialDate.year);
  const [selectedMonth, setSelectedMonth] = useState(initialDate.month);
  const [selectedDay, setSelectedDay] = useState(initialDate.day);
  const [typedText, setTypedText] = useState(() =>
    formatDateForInput(initialDate.year, initialDate.month, initialDate.day, dateFormat),
  );
  const [inputError, setInputError] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedYear(initialDate.year);
      setSelectedMonth(initialDate.month);
      setSelectedDay(initialDate.day);
      setTypedText(
        formatDateForInput(initialDate.year, initialDate.month, initialDate.day, dateFormat),
      );
      setInputError(null);
    }
  }, [visible, initialDate, dateFormat]);

  const startYear = new Date().getFullYear() - 1;
  const years = useMemo(() => Array.from({ length: 18 }, (_, i) => startYear + i), [startYear]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);

  const daysInMonth = useMemo(
    () => getDaysInMonth(selectedYear, selectedMonth),
    [selectedYear, selectedMonth],
  );

  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [daysInMonth, selectedDay]);

  const yearIndex = useMemo(() => {
    const idx = years.indexOf(selectedYear);
    return idx >= 0 ? idx : 0;
  }, [years, selectedYear]);

  const dayIndex = useMemo(() => {
    const idx = days.indexOf(selectedDay);
    return idx >= 0 ? idx : 0;
  }, [days, selectedDay]);

  const applyPreset = useCallback((preset: (typeof PRESETS)[number]) => {
    const target = new Date();
    if (preset.days) {
      target.setDate(target.getDate() + preset.days);
    } else if (preset.months) {
      target.setMonth(target.getMonth() + preset.months);
    }
    const y = target.getFullYear();
    const m = target.getMonth();
    const d = target.getDate();
    setSelectedYear(y);
    setSelectedMonth(m);
    setSelectedDay(d);
    setTypedText(formatDateForInput(y, m, d, dateFormat));
    setInputError(null);
  }, [dateFormat]);
  const handleTypedTextChange = (text: string) => {
    setTypedText(text);
    if (!text.trim()) {
      setInputError(null);
      return;
    }
    const detected = detectNaturalDate(text, { countryCode: userCountry });
    if (detected) {
      setSelectedYear(detected.year);
      setSelectedMonth(detected.month);
      setSelectedDay(detected.day);
      setInputError(null);
    } else if (text.trim().length >= 4) {
      setInputError(`e.g. ${dateFormat === 'DMY' ? '13/9/26' : '9/13/26'}, Sep 13, +1w`);
    } else {
      setInputError(null);
    }
  };

  const handleConfirm = () => {
    if (typedText.trim()) {
      const detected = detectNaturalDate(typedText, { countryCode: userCountry });
      if (detected) {
        onConfirm(detected.iso);
        onClose();
        return;
      }
      setInputError(`Please enter a valid date (e.g. ${dateFormat === 'DMY' ? '13/9/26' : '9/13/26'}, Sep 13, +1w)`);
      return;
    }
    const isoString = `${selectedYear}-${pad2(selectedMonth + 1)}-${pad2(selectedDay)}`;
    onConfirm(isoString);
    onClose();
  };

  const formattedPreview = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth, selectedDay);
    return (
      formatDate(d, userCountry, { style: 'medium' }) ||
      formatDateForInput(selectedYear, selectedMonth, selectedDay, dateFormat)
    );
  }, [selectedYear, selectedMonth, selectedDay, userCountry, dateFormat]);
  const isDark = theme.scheme === 'dark';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <TouchableWithoutFeedback onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss modal">
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: isDark ? theme.colors.bgElevated : '#FAFAF8',
              borderColor: isDark ? theme.colors.border : 'rgba(44, 44, 40, 0.08)',
            },
          ]}
        >
            {/* Top Sheet Grabber Handle */}
            <View
              style={[
                styles.handleBar,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(44, 44, 40, 0.14)' },
              ]}
            />

            {/* Header Bar */}
            <View style={styles.headerRow}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{title}</Text>
              <Pressable
                hitSlop={8}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close date picker"
                style={({ pressed }) => [
                  styles.closeBtn,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(44, 44, 40, 0.08)',
                    transform: [{ scale: pressed ? 0.92 : 1 }],
                  },
                ]}
              >
                <Ionicons name="close" size={18} color={theme.colors.neutralMid} />
              </Pressable>
            </View>

            {/* Live Editable Date Input Bar (always visible & typeable) */}
            <View style={{ gap: 4 }}>
              <View
                style={[
                  styles.dateInputBar,
                  {
                    backgroundColor: isDark ? '#111512' : '#FFFFFF',
                    borderColor: inputError
                      ? theme.colors.danger
                      : isInputFocused
                        ? theme.colors.primary
                        : isDark
                          ? theme.colors.border
                          : 'rgba(44, 44, 40, 0.12)',
                  },
                ]}
              >
                <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
                <TextInput
                  testID="date-picker-text-input"
                  accessibilityLabel="Type expiry date"
                  style={[styles.dateTextInput, { color: theme.colors.text }]}
                  placeholder={dateFormat === 'DMY' ? 'e.g. 13/9/26, Sep 13, +1w' : 'e.g. 9/13/26, Sep 13, +1w'}
                  placeholderTextColor={theme.colors.textMuted}
                  value={typedText}
                  onChangeText={handleTypedTextChange}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  keyboardType="default"
                  returnKeyType="done"
                  onSubmitEditing={handleConfirm}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                <View
                  style={[
                    styles.previewBadge,
                    { backgroundColor: isDark ? 'rgba(75, 174, 138, 0.18)' : '#D6F0E6' },
                  ]}
                >
                  <Text style={{ color: isDark ? '#FAFAF8' : '#2C2C28', fontSize: 12, fontWeight: '700' }}>
                    {formattedPreview}
                  </Text>
                </View>
              </View>
              {inputError ? (
                <Text style={{ color: theme.colors.danger, fontSize: 12, paddingHorizontal: 4 }}>
                  {inputError}
                </Text>
              ) : null}
            </View>

          {/* Quick Preset Chips */}
          <View style={{ gap: 6 }}>
            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}
            >
              Quick Expiry Presets
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
              {PRESETS.map((p) => (
                <Pressable
                  key={p.label}
                  accessibilityRole="button"
                  accessibilityLabel={`Preset ${p.label}`}
                  onPress={() => applyPreset(p)}
                  style={({ pressed }) => [
                    styles.presetChip,
                    {
                      backgroundColor: isDark
                        ? (pressed ? 'rgba(75, 174, 138, 0.25)' : theme.colors.bgElevated)
                        : (pressed ? '#D6F0E6' : '#FFFFFF'),
                      borderColor: isDark ? theme.colors.border : 'rgba(44, 44, 40, 0.08)',
                      transform: [{ scale: pressed ? 0.94 : 1 }],
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: isDark ? theme.colors.text : theme.colors.neutralDark,
                      fontSize: 13,
                      fontWeight: '600',
                    }}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

            {/* Wheel Picker Surface (always visible alongside typing) */}
            <View
              style={[
                styles.pickerFrame,
                {
                  backgroundColor: isDark ? '#111512' : '#FFFFFF',
                  borderColor: isDark ? theme.colors.border : 'rgba(44, 44, 40, 0.08)',
                },
              ]}
            >
              {/* Center Selection Highlight Bar */}
              <View
                pointerEvents="none"
                style={[
                  styles.selectionHighlight,
                  {
                    backgroundColor: isDark ? 'rgba(75, 174, 138, 0.20)' : '#D6F0E6',
                    borderColor: isDark ? '#4BAE8A' : '#3A8F6F',
                  },
                ]}
              />

              {/* Day Column */}
              <WheelColumn<number>
                items={days}
                selectedIndex={dayIndex}
                onSelect={(idx) => {
                  const d = days[idx] ?? 1;
                  setSelectedDay(d);
                  setTypedText(formatDateForInput(selectedYear, selectedMonth, d, dateFormat));
                  setInputError(null);
                }}
                renderLabel={(d) => `${d}`}
                flex={1}
              />

              {/* Month Column */}
              <WheelColumn<number>
                items={months}
                selectedIndex={selectedMonth}
                onSelect={(idx) => {
                  setSelectedMonth(idx);
                  setTypedText(formatDateForInput(selectedYear, idx, selectedDay, dateFormat));
                  setInputError(null);
                }}
                renderLabel={(m) => (countryMeta.code === 'VN' ? MONTH_NAMES_VN[m] : MONTH_NAMES_EN[m]) ?? ''}
                flex={1.8}
              />

              {/* Year Column */}
              <WheelColumn<number>
                items={years}
                selectedIndex={yearIndex}
                onSelect={(idx) => {
                  const y = years[idx] ?? selectedYear;
                  setSelectedYear(y);
                  setTypedText(formatDateForInput(y, selectedMonth, selectedDay, dateFormat));
                  setInputError(null);
                }}
                renderLabel={(y) => `${y}`}
                flex={1.2}
              />
            </View>
            <View style={styles.actionsRow}>
              <Pressable
                testID="date-picker-cancel"
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={onClose}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: pressed ? theme.colors.bgGlass : theme.colors.bgElevated,
                  },
                ]}
              >
                <Text style={{ color: theme.colors.textMuted, fontSize: 14, fontWeight: '600' }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                testID="date-picker-done"
                accessibilityRole="button"
                accessibilityLabel="Done"
                onPress={handleConfirm}
                style={({ pressed }) => [
                  styles.doneBtn,
                  {
                    backgroundColor: theme.colors.accent,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={{ color: theme.colors.textInverse, fontSize: 14, fontWeight: '700' }}>
                  Done
                </Text>
              </Pressable>
            </View>
          </View>
    </KeyboardAvoidingView>
  </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  handleBar: {
    width: 32,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  dateInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 40,
    gap: 8,
  },
  dateTextInput: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: 0.3,
    paddingVertical: 0,
  },
  previewBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  backdropPressable: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  closeBtn: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChip: {
    minHeight: 44,
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 22,
    borderWidth: 1,
  },
  pickerFrame: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  selectionHighlight: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: PADDING_ITEMS * ITEM_HEIGHT,
    height: ITEM_HEIGHT,
    borderRadius: 8,
    borderWidth: 1,
  },
  columnContainer: {
    height: '100%',
  },
  itemRow: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  itemText: {
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
