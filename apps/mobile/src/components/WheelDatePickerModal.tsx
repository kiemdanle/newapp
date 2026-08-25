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
  const scrollRef = useRef<ScrollView>(null);
  const isUserScrolling = useRef(false);

  useEffect(() => {
    if (!isUserScrolling.current) {
      scrollRef.current?.scrollTo({
        y: selectedIndex * ITEM_HEIGHT,
        animated: true,
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
          const opacity = isSelected ? 1 : distance === 1 ? 0.45 : 0.2;

          return (
            <Pressable
              key={idx}
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
                    color: isSelected ? theme.colors.text : theme.colors.textMuted,
                    opacity,
                    fontSize: isSelected ? 17 : 14,
                    fontWeight: isSelected ? '700' : '500',
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
    try {
      const d = new Date(selectedYear, selectedMonth, selectedDay);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return `${selectedYear}-${pad2(selectedMonth + 1)}-${pad2(selectedDay)}`;
    }
  }, [selectedYear, selectedMonth, selectedDay]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.modalCard,
            { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header Bar */}
          <View style={styles.headerRow}>
            <View style={{ gap: 2 }}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{title}</Text>
              <Text style={{ color: theme.colors.primaryDark, fontSize: 13, fontWeight: '700' }}>
                🗓️ {formattedPreview}
              </Text>
            </View>
            <Pressable
              hitSlop={8}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close date picker"
              style={[styles.closeBtn, { backgroundColor: theme.colors.bgGlass }]}
            >
              <Ionicons name="close" size={20} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          {/* Quick Preset Chips */}
          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
              QUICK EXPIRY PRESETS
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {PRESETS.map((p) => (
                <Pressable
                  key={p.label}
                  accessibilityRole="button"
                  accessibilityLabel={`Preset ${p.label}`}
                  onPress={() => applyPreset(p)}
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: theme.colors.bgGlass,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: theme.colors.primaryDark, fontSize: 12, fontWeight: '700' }}>
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
              { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border },
            ]}
          >
            {/* Center Selection Highlight Bar */}
            <View
              pointerEvents="none"
              style={[
                styles.selectionHighlight,
                {
                  backgroundColor: theme.colors.primaryLight,
                  borderColor: theme.colors.primary,
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
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
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
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  pickerFrame: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  selectionHighlight: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: PADDING_ITEMS * ITEM_HEIGHT,
    height: ITEM_HEIGHT,
    borderRadius: 10,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    opacity: 0.6,
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
