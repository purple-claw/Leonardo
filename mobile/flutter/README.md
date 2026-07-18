# Leonardo Mobile (Flutter)

Minimal Flutter app scaffold for Android.

Run locally (requires Flutter SDK):

```bash
cd mobile/flutter
flutter pub get
flutter run -d emulator-5554   # or a connected Android device
```

Notes:
- The app includes a minimal `Login` and `Dashboard` screen in `lib/main.dart`.
- To integrate with the Leonardo backend, update the `apiBase` variable in `lib/main.dart`.
