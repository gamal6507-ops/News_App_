import 'package:hive/hive.dart';

class NotificationPreferences {
  static const _boxName = 'app_settings';
  static const _key = 'notifications_enabled';

  static bool get enabled =>
      !Hive.isBoxOpen(_boxName) ||
      Hive.box(_boxName).get(_key, defaultValue: true) != false;

  static Future<void> setEnabled(bool enabled) async {
    final box = Hive.isBoxOpen(_boxName)
        ? Hive.box(_boxName)
        : await Hive.openBox(_boxName);
    await box.put(_key, enabled);
  }
}
