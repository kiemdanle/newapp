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
const LOOP_MULTIPLIER = 5; // 5 copies (blocks 0, 1, 2 [center], 3, 4) for lightweight 60fps scrolling
const MID_BLOCK = 2;
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
  loop?: boolean;
  testID?: string;
}

interface DisplayItem<T> {
  item: T;
  originalIndex: number;
  virtualIndex: number;
}

interface WheelRowProps {
  label: string;
  virtualIndex: number;
  originalIndex: number;
  isSelected: boolean;
  distance: number;
  isDark: boolean;
  onPressItem: (virtualIndex: number, originalIndex: number) => void;
}

const WheelRow = React.memo(
  function WheelRow({
    label,
    virtualIndex,
    originalIndex,
    isSelected,
    distance,
    isDark,
    onPressItem,
  }: WheelRowProps) {
    const textColor = isSelected
      ? (isDark ? '#4BAE8A' : '#2C2C28')
      : (isDark ? '#B7BDB7' : '#73736C');
    const opacity = isSelected ? 1 : distance === 1 ? 0.75 : 0.45;
    const fontSize = isSelected ? 16 : 14;
    const fontWeight: '700' | '500' = isSelected ? '700' : '500';

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => onPressItem(virtualIndex, originalIndex)}
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
              fontWeight,
            },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  },
  (prev, next) => {
    const prevBucket = prev.isSelected ? 0 : prev.distance === 1 ? 1 : 2;
    const nextBucket = next.isSelected ? 0 : next.distance === 1 ? 1 : 2;
    return (
      prevBucket === nextBucket &&
      prev.label === next.label &&
      prev.isDark === next.isDark
    );
  },
);

function WheelColumn<T>({
  items,
  selectedIndex,
  onSelect,
  renderLabel,
  flex = 1,
  loop = false,
  testID,
}: WheelColumnProps<T>) {
  const theme = useTheme();
  const isDark = theme.scheme === 'dark';
  const scrollRef = useRef<ScrollView>(null);
  const isUserScrolling = useRef(false);
  const isMomentumRef = useRef(false);
  const scrollEndDragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSelectedByWheelRef = useRef<number | null>(null);
  const finalizedOffsetRef = useRef<number | null>(null);
  const N = items.length;
  const isLooping = Boolean(loop && N > 1);
  const currentVirtualRef = useRef(isLooping ? MID_BLOCK * N + selectedIndex : selectedIndex);
  const [localSelectedIndex, setLocalSelectedIndex] = useState(selectedIndex);
  const lastScrollYRef = useRef((isLooping ? MID_BLOCK * N + selectedIndex : selectedIndex) * ITEM_HEIGHT);
  const displayItems = useMemo<DisplayItem<T>[]>(() => {
    if (!isLooping) {
      return items.map((item, originalIndex) => ({
        item,
        originalIndex,
        virtualIndex: originalIndex,
      }));
    }
    const result: DisplayItem<T>[] = [];
    for (let b = 0; b < LOOP_MULTIPLIER; b++) {
      for (const [i, item] of items.entries()) {
        result.push({
          item,
          originalIndex: i,
          virtualIndex: b * N + i,
        });
      }
    }
    return result;
  }, [items, isLooping, N]);

  const initialOffset = (isLooping ? MID_BLOCK * N + selectedIndex : selectedIndex) * ITEM_HEIGHT;

  useEffect(() => {
    return () => {
      clearTimeout(scrollEndDragTimerRef.current ?? undefined);
      clearTimeout(scrollSettleTimerRef.current ?? undefined);
    };
  }, []);

  // Synchronize scroll position only on external changes (presets, text typing, month clamps).
  // Skips redundant scrollTo when the change originated from the user scrolling this wheel.
  useEffect(() => {
    setLocalSelectedIndex(selectedIndex);
    if (lastSelectedByWheelRef.current === selectedIndex) {
      lastSelectedByWheelRef.current = null;
      return;
    }
    lastSelectedByWheelRef.current = null;
    if (!isUserScrolling.current) {
      const targetVirtual = isLooping ? MID_BLOCK * N + selectedIndex : selectedIndex;
      currentVirtualRef.current = targetVirtual;
      lastScrollYRef.current = targetVirtual * ITEM_HEIGHT;
      scrollRef.current?.scrollTo({
        y: targetVirtual * ITEM_HEIGHT,
        animated: false,
      });
    }
  }, [selectedIndex, isLooping, N]);

  const finalizeScroll = (contentOffsetY: number) => {
    isUserScrolling.current = false;
    isMomentumRef.current = false;
    clearTimeout(scrollSettleTimerRef.current ?? undefined);
    clearTimeout(scrollEndDragTimerRef.current ?? undefined);

    const roundedY = Math.round(contentOffsetY / ITEM_HEIGHT) * ITEM_HEIGHT;
    if (finalizedOffsetRef.current === roundedY) {
      return;
    }
    finalizedOffsetRef.current = roundedY;

    if (isLooping) {
      const rawVIdx = Math.round(contentOffsetY / ITEM_HEIGHT);
      const realIndex = ((rawVIdx % N) + N) % N;

      setLocalSelectedIndex(realIndex);
      lastSelectedByWheelRef.current = realIndex;
      if (realIndex !== selectedIndex) {
        onSelect(realIndex);
      }

      // Only re-center if drifted close to outer boundaries (Block 0 or Block 4),
      // preserving native smooth momentum without layout jumps during normal scrolling.
      if (rawVIdx < N || rawVIdx >= (LOOP_MULTIPLIER - 1) * N) {
        const centeredVirtual = MID_BLOCK * N + realIndex;
        currentVirtualRef.current = centeredVirtual;
        lastScrollYRef.current = centeredVirtual * ITEM_HEIGHT;
        finalizedOffsetRef.current = centeredVirtual * ITEM_HEIGHT;
        scrollRef.current?.scrollTo({
          y: centeredVirtual * ITEM_HEIGHT,
          animated: false,
        });
      } else {
        currentVirtualRef.current = rawVIdx;
        lastScrollYRef.current = rawVIdx * ITEM_HEIGHT;
      }
    } else {
      const index = Math.max(0, Math.min(N - 1, Math.round(contentOffsetY / ITEM_HEIGHT)));
      setLocalSelectedIndex(index);
      currentVirtualRef.current = index;
      lastSelectedByWheelRef.current = index;
      lastScrollYRef.current = index * ITEM_HEIGHT;
      if (index !== selectedIndex) {
        onSelect(index);
      }
    }
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    lastScrollYRef.current = y;

    // 1. Immediately update visual bold highlight as items pass through the center slot
    const rawVIdx = Math.round(y / ITEM_HEIGHT);
    const currentRealIndex = isLooping
      ? ((rawVIdx % N) + N) % N
      : Math.max(0, Math.min(N - 1, rawVIdx));
    setLocalSelectedIndex((prev) => (prev === currentRealIndex ? prev : currentRealIndex));

    // 2. Debounce settling: whenever scrolling motion stops for 60ms, finalize immediately!
    clearTimeout(scrollSettleTimerRef.current ?? undefined);
    scrollSettleTimerRef.current = setTimeout(() => {
      finalizeScroll(lastScrollYRef.current);
    }, 60);
  };

  const handleScrollBeginDrag = () => {
    isUserScrolling.current = true;
    isMomentumRef.current = false;
    finalizedOffsetRef.current = null;
    clearTimeout(scrollEndDragTimerRef.current ?? undefined);
    clearTimeout(scrollSettleTimerRef.current ?? undefined);
  };

  const handleMomentumScrollBegin = () => {
    isMomentumRef.current = true;
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    finalizeScroll(e.nativeEvent.contentOffset.y);
  };

  const handleScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isUserScrolling.current = false;
    const y = e.nativeEvent.contentOffset.y;
    lastScrollYRef.current = y;
    clearTimeout(scrollSettleTimerRef.current ?? undefined);
    scrollSettleTimerRef.current = setTimeout(() => {
      finalizeScroll(lastScrollYRef.current);
    }, 60);
  };

  const handlePressItem = useCallback(
    (virtualIndex: number, originalIndex: number) => {
      isUserScrolling.current = false;
      isMomentumRef.current = false;
      setLocalSelectedIndex(originalIndex);
      lastSelectedByWheelRef.current = originalIndex;
      currentVirtualRef.current = virtualIndex;
      lastScrollYRef.current = virtualIndex * ITEM_HEIGHT;
      onSelect(originalIndex);
      scrollRef.current?.scrollTo({ y: virtualIndex * ITEM_HEIGHT, animated: true });
    },
    [onSelect],
  );

  return (
    <View style={[styles.columnContainer, { flex }]}>
      <ScrollView
        testID={testID}
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        nestedScrollEnabled
        scrollEventThrottle={16}
        onScroll={handleScroll}
        contentOffset={{ x: 0, y: initialOffset }}
        onLayout={() => {
          scrollRef.current?.scrollTo({ y: currentVirtualRef.current * ITEM_HEIGHT, animated: false });
        }}
        onScrollBeginDrag={handleScrollBeginDrag}
        onMomentumScrollBegin={handleMomentumScrollBegin}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScrollEndDrag={handleScrollEndDrag}
        contentContainerStyle={{
          paddingVertical: PADDING_ITEMS * ITEM_HEIGHT,
        }}
      >
        {displayItems.map((entry) => {
          const diff = Math.abs(entry.originalIndex - localSelectedIndex);
          const distance = isLooping ? Math.min(diff, N - diff) : diff;
          const isSelected = distance === 0;

          return (
            <WheelRow
              key={entry.virtualIndex}
              label={renderLabel(entry.item)}
              virtualIndex={entry.virtualIndex}
              originalIndex={entry.originalIndex}
              isSelected={isSelected}
              distance={distance}
              isDark={isDark}
              onPressItem={handlePressItem}
            />
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

              {/* Day Column (Loops) */}
              <WheelColumn<number>
                testID="wheel-picker-day"
                items={days}
                selectedIndex={dayIndex}
                loop={true}
                onSelect={(idx) => {
                  const d = days[idx] ?? 1;
                  setSelectedDay(d);
                  setTypedText(formatDateForInput(selectedYear, selectedMonth, d, dateFormat));
                  setInputError(null);
                }}
                renderLabel={(d) => `${d}`}
                flex={1}
              />

              {/* Month Column (Loops) */}
              <WheelColumn<number>
                testID="wheel-picker-month"
                items={months}
                selectedIndex={selectedMonth}
                loop={true}
                onSelect={(idx) => {
                  setSelectedMonth(idx);
                  setTypedText(formatDateForInput(selectedYear, idx, selectedDay, dateFormat));
                  setInputError(null);
                }}
                renderLabel={(m) => (countryMeta.code === 'VN' ? MONTH_NAMES_VN[m] : MONTH_NAMES_EN[m]) ?? ''}
                flex={1.8}
              />

              {/* Year Column (Bounded) */}
              <WheelColumn<number>
                testID="wheel-picker-year"
                items={years}
                selectedIndex={yearIndex}
                loop={false}
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
