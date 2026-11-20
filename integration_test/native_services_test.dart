import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:hive/hive.dart';
import 'package:integration_test/integration_test.dart';
import 'package:news_paper_app/core/service/notification_service.dart';
import 'package:news_paper_app/core/network/dio_client.dart';
import 'package:news_paper_app/data/datasource/remote_data/news_api_service.dart';
import 'package:news_paper_app/firebase_options.dart';
import 'package:timezone/data/latest.dart' as tz;

Future<void> nativeWork(
  WidgetTester tester,
  Future<void> Function() body,
) async {
  final completed = await tester.runAsync(() async {
    await body().timeout(const Duration(seconds: 60));
    return true;
  });
  expect(completed, isTrue);
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'Android retrieves Egyptian news and a real article image',
    (tester) => nativeWork(tester, () async {
      final client = DioClient();
      try {
        final response = await NewsApiService(
          client,
        ).getTopHeadlines(country: 'eg', pageSize: 3);
        expect(response.statusCode, 200);
        final articles = response.data['articles'] as List;
        expect(articles, isNotEmpty);
        final imageUrl = articles
            .map((a) => a['urlToImage'])
            .whereType<String>()
            .first;
        final image = await client.dio.get<List<int>>(
          imageUrl,
          options: Options(responseType: ResponseType.bytes),
        );
        expect(image.statusCode, 200);
        expect(image.headers.value('content-type'), startsWith('image/'));
        expect(image.data!.length, greaterThan(100));
      } finally {
        client.dio.close();
      }
    }),
  );

  testWidgets(
    'native Google SDK initializes with the Android app configuration',
    (tester) => nativeWork(tester, () async {
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
      await GoogleSignIn.instance.initialize();
      expect(GoogleSignIn.instance.supportsAuthenticate(), isTrue);
    }),
  );

  testWidgets(
    'Android schedules and cancels the app inactivity reminder',
    (tester) => nativeWork(tester, () async {
      final folder = await Directory.systemTemp.createTemp('news-native-qa-');
      Hive.init(folder.path);
      await Hive.openBox('app_settings');
      tz.initializeTimeZones();
      final plugin = FlutterLocalNotificationsPlugin();
      await plugin.initialize(
        const InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        ),
      );
      final service = NotificationService();
      try {
        await service.scheduleInactivityReminder();
        expect(
          (await plugin.pendingNotificationRequests()).any(
            (r) => r.id == 999999,
          ),
          isTrue,
        );
        await service.cancelInactivityReminder();
        expect(
          (await plugin.pendingNotificationRequests()).any(
            (r) => r.id == 999999,
          ),
          isFalse,
        );
      } finally {
        await service.cancelInactivityReminder();
        await Hive.close();
        expect(folder.parent.absolute.path, Directory.systemTemp.absolute.path);
        await folder.delete(recursive: true);
      }
    }),
  );
}
