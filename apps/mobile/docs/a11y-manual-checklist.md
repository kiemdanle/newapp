# Mobile accessibility — manual screen-reader checklist

This must be run before every release. CI cannot replace it. Two devices, ~45 minutes total.

## Devices

- iOS: physical iPhone running latest iOS, VoiceOver enabled (Settings → Accessibility → VoiceOver → On)
- Android: physical Pixel running latest Android, TalkBack enabled (Settings → Accessibility → TalkBack → On)

If only one platform is available, document which was tested in the release PR and schedule the missing one within 48h.

## Setup

1. Install the `preview` channel build via TestFlight / Play Internal Testing
2. Reset to a fresh install (delete + reinstall) to walk onboarding
3. Set system font scale to 100% (Display & Brightness → Text Size = default)
4. Enable the screen reader
5. Enable spoken hints (VoiceOver: Settings → Accessibility → VoiceOver → Verbosity → Hints; TalkBack: on by default)

## Checklist

### Onboarding

- [ ] Welcome screen: focus order is heading → body → primary action → secondary action
- [ ] Every tappable element announces its role (button, link)
- [ ] No hidden or empty focus stops
- [ ] Sign-in link is clearly labelled "Sign in, button"

### Sign in / Sign up

- [ ] Email and password fields announce label + "text field"
- [ ] Error messages are spoken when they appear
- [ ] Submit button announces "Sign in, button" (not just "button")
- [ ] Forgot password link announces destination

### Home / Pantry

- [ ] Focus lands on screen heading first
- [ ] Each record row/card announces product name, expiry date, and quantity
- [ ] FAB announces "Scan, button" (or equivalent action)
- [ ] Empty state is readable and not skipped

### Scan

- [ ] Camera preview is hidden from screen reader (`accessibilityElementsHidden`)
- [ ] Shutter/manual entry controls are labelled
- [ ] Barcode result is spoken

### Product detail

- [ ] Product name, brand, shelf life are readable in order
- [ ] Add-record form fields have labels
- [ ] Save button is labelled

### Reviews

- [ ] Star rating control announces value
- [ ] Review list items announce author, rating, and text
- [ ] Upvote/downvote buttons announce state

### Settings

- [ ] Theme switcher cards announce "Use <theme> theme, radio button" and selected state
- [ ] Toggle rows announce label + current state (on/off)
- [ ] Delete account button announces destructive action

### Navigation

- [ ] Bottom tab bar items announce label + "tab"
- [ ] Selected tab state is spoken
- [ ] Back gesture/button announces "Back, button"

### Large text (bonus)

- [ ] At 200% font scale, no critical text is clipped
- [ ] Layouts scroll when content overflows
- [ ] Touch targets remain separated

## Known capped elements

The app applies a global `maxFontSizeMultiplier = 1.5` (200% system text size) to all `<Text>` and `<TextInput>` components via `_layout.tsx` defaultProps. This prevents layout shatter while allowing the full dynamic-type range up to 200%.

Components that may opt out with an explicit `allowFontScaling={false}` (documented below with rationale):

| Component / screen | Cap | Reason |
|---|---|---|
| (none currently) | — | — |

## Sign-off

- Tester: _______
- iOS device: _______
- Android device: _______
- Date: _______
- Issues found: _______
