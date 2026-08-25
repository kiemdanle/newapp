# Camera Settings Permission Design

## Goal

Help a user enable camera access when they open barcode or QR code scanning after camera permission has been denied.

## Scope

- Preserve the existing first-time camera permission pre-prompt and system permission request.
- Replace the denied-permission fallback with an in-app modal that explains why camera access is needed.
- Provide an **Open Settings** action that opens the operating system's settings page for this app.
- Provide a cancel action that returns to the previous screen.
- Re-check camera permission when the app becomes active again, so scanning starts as soon as permission is enabled.

## Out of Scope

- Changes to barcode or QR recognition.
- New permission types or settings screens.
- Repeated system permission requests after a denial.

## Behavior

1. The scan screen checks camera permission on entry, as it does today.
2. If permission is denied, it shows the in-app modal instead of an inactive scan screen.
3. Selecting **Open Settings** opens the app-specific system Settings page.
4. Selecting cancel navigates back.
5. When the app returns to the foreground, the scan screen checks permission again. If granted, it renders the camera scanner; if still denied, the modal remains available.

## Testing

- Verify the denied state renders the camera-access modal and its explanation.
- Verify selecting **Open Settings** calls the platform settings API.
- Verify returning to the foreground re-checks permission and enables scanning after it is granted.
