import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/useTheme';
import { Button } from './Button';
import { formatDate } from '../utils/country-format';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PADDING_ITEMS = Math.floor(VISIBLE_ITEMS / 2); // 2 items padding on top and bottom

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const PRESETS = [
  { label: '+3 Days', days: 3 },
  { label: '+1 Week', days: 7 },
  { label: '+2 Weeks', days: 14 },
  { label: '+1 Month', months: 1 },
  { label: '+3 Months', months: 3 },
  { label: '+6 Months', months: 6 },
  { label: '+1 Year', years: 1 },
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
          const fontSize = isSelected ? 18 : distance === 1 ? 16 : 14;
          const fontWeight = isSelected ? '700' : distance === 1 ? '600' : '500';

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

  const [selectedYear, setSelectedYear] = useState(initialDate.year);
  const [selectedMonth, setSelectedMonth] = useState(initialDate.month);
  const [selectedDay, setSelectedDay] = useState(initialDate.day);

  useEffect(() => {
    if (visible) {
      setSelectedYear(initialDate.year);
      setSelectedMonth(initialDate.month);
      setSelectedDay(initialDate.day);
    }
  }, [visible, initialDate]);

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
    } else if (preset.years) {
      target.setFullYear(target.getFullYear() + preset.years);
    }
    setSelectedYear(target.getFullYear());
    setSelectedMonth(target.getMonth());
    setSelectedDay(target.getDate());
  }, []);

  const handleConfirm = () => {
    const isoString = `${selectedYear}-${pad2(selectedMonth + 1)}-${pad2(selectedDay)}`;
    onConfirm(isoString);
    onClose();
  };

  const formattedPreview = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth, selectedDay);
    return formatDate(d, null, { style: 'medium' }) || `${selectedYear}-${pad2(selectedMonth + 1)}-${pad2(selectedDay)}`;
  }, [selectedYear, selectedMonth, selectedDay]);

  const isDark = theme.scheme === 'dark';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.modalCard,
            {
              backgroundColor: isDark ? theme.colors.bgElevated : '#FAFAF8',
              borderColor: isDark ? theme.colors.border : 'rgba(44, 44, 40, 0.08)',
            },
          ]}
          onPress={(e) => e.stopPropagation()}
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
            <View style={{ gap: 4 }}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{title}</Text>
              <View
                style={[
                  styles.previewBadge,
                  { backgroundColor: isDark ? 'rgba(75, 174, 138, 0.18)' : '#D6F0E6' },
                ]}
              >
                <Ionicons name="calendar-outline" size={14} color={isDark ? '#4BAE8A' : '#3A8F6F'} />
                <Text style={{ color: isDark ? '#FAFAF8' : '#2C2C28', fontSize: 13, fontWeight: '700' }}>
                  {formattedPreview}
                </Text>
              </View>
            </View>
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

          {/* Wheel Picker Surface */}
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
              onSelect={(idx) => setSelectedDay(days[idx] ?? 1)}
              renderLabel={(d) => `${d}`}
              flex={1}
            />

            {/* Month Column */}
            <WheelColumn<number>
              items={months}
              selectedIndex={selectedMonth}
              onSelect={(idx) => setSelectedMonth(idx)}
              renderLabel={(m) => MONTH_NAMES[m] ?? ''}
              flex={1.8}
            />

            {/* Year Column */}
            <WheelColumn<number>
              items={years}
              selectedIndex={yearIndex}
              onSelect={(idx) => setSelectedYear(years[idx] ?? startYear)}
              renderLabel={(y) => `${y}`}
              flex={1.2}
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <View style={{ flex: 1 }}>
              <Button label="Cancel" variant="ghost" onPress={onClose} />
            </View>
            <View style={{ flex: 1 }}>
              <Button testID="date-picker-done" label="Done" onPress={handleConfirm} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  handleBar: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2C2C28',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  presetChip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
    shadowColor: '#2C2C28',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  pickerFrame: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#2C2C28',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  selectionHighlight: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: PADDING_ITEMS * ITEM_HEIGHT,
    height: ITEM_HEIGHT,
    borderRadius: 12,
    borderWidth: 1,
  },
  columnContainer: {
    height: '100%',
  },
  itemRow: {
    minHeight: 44,
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
    gap: 12,
    marginTop: 4,
  },
});
