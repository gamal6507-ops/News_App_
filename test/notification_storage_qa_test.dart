import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:news_paper_app/core/service/notification_storage_service.dart';
import 'package:news_paper_app/domain/entities/notification_item.dart';

void main() {
  late Directory folder;
  setUp(() async {
    folder = await Directory.systemTemp.createTemp('news-qa-notifications-');
    Hive.init(folder.path);
    await Hive.openBox('app_settings');
  });
  tearDown(() async {
    await Hive.close();
    expect(folder.parent.absolute.path, Directory.systemTemp.absolute.path);
    await folder.delete(recursive: true);
  });
  NotificationItem item() => NotificationItem(
    id: 'qa-test',
    title: 'Test',
    body: 'Body',
    time: DateTime.utc(2026, 11, 19, 8, 43, 21),
    type: NotificationType.system,
    isRead: false,
  );
  test(
    'notification timestamps preserve their date and time through storage',
    () async {
      final storage = NotificationStorageService();
      await storage.add(item());
      final restored = (await storage.getAll()).single;
      expect(restored.time, item().time);
    },
  );
  test(
    'disabled notification preference prevents new in-app notifications',
    () async {
      await Hive.box('app_settings').put('notifications_enabled', false);
      final storage = NotificationStorageService();
      await storage.add(item());
      expect(await storage.getAll(), isEmpty);
    },
  );
}
