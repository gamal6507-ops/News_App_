import 'dart:async';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:news_paper_app/core/routes/app_router.dart';
import 'package:news_paper_app/domain/entities/article.dart';
import 'package:news_paper_app/domain/entities/user_entity.dart';
import 'package:news_paper_app/domain/repositories/base_user_repository.dart';
import 'package:news_paper_app/domain/repositories/base_saved_reposirotry.dart';
import 'package:news_paper_app/presentation/cubits/auth/auth_cubit.dart';
import 'package:news_paper_app/presentation/cubits/favorite/saved_cubit.dart';
import 'package:news_paper_app/presentation/pages/login_page.dart';
import 'package:news_paper_app/presentation/pages/saved_page.dart';
import 'package:news_paper_app/presentation/widgets/responsive_shell.dart';

class _Loader extends AssetLoader {
  const _Loader();
  @override
  Future<Map<String, dynamic>> load(String path, Locale locale) async => {};
}

class _AuthRepository extends Fake implements BaseAuthRepository {
  final changes = StreamController<UserEntity?>.broadcast();
  @override
  Stream<UserEntity?> get authStateChanges => changes.stream;
  @override
  UserEntity? getCurrentUser() => null;
}

class _SavedRepository extends Fake implements BaseSavedRepository {
  @override
  Future<List<Article>> getSaved() async => [];
}

Widget localized(Widget child) => EasyLocalization(
  supportedLocales: const [Locale('en')],
  startLocale: const Locale('en'),
  saveLocale: false,
  path: 'test',
  assetLoader: const _Loader(),
  child: child,
);

class _Counter extends StatefulWidget {
  const _Counter();
  @override
  State<_Counter> createState() => _CounterState();
}

class _CounterState extends State<_Counter> {
  int value = 0;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: TextButton(
      onPressed: () => setState(() => value++),
      child: Text('Count $value'),
    ),
  );
}

void main() {
  test(
    'generated routes retain their names for active navigation selection',
    () {
      for (final name in ['/search', '/saved', '/settings', '/login']) {
        expect(
          AppRouter.onGenerateRoute(RouteSettings(name: name)).settings.name,
          name,
        );
      }
    },
  );
  testWidgets('signed out users cannot reopen protected saved pages', (
    tester,
  ) async {
    final repository = _AuthRepository();
    final auth = AuthCubit(repository);
    final saved = SavedCubit(_SavedRepository());
    addTearDown(auth.close);
    addTearDown(saved.close);
    addTearDown(repository.changes.close);
    await saved.getSaved();
    repository.changes.add(
      const UserEntity(id: 'test', name: 'Test', email: 'test@example.com'),
    );
    await tester.pump();
    await tester.pumpWidget(
      localized(
        MultiBlocProvider(
          providers: [
            BlocProvider.value(value: auth),
            BlocProvider.value(value: saved),
          ],
          child: Builder(
            builder: (context) => MaterialApp(
              locale: context.locale,
              supportedLocales: context.supportedLocales,
              localizationsDelegates: context.localizationDelegates,
              onGenerateInitialRoutes: (_) => [
                AppRouter.onGenerateRoute(const RouteSettings(name: '/saved')),
              ],
              onGenerateRoute: AppRouter.onGenerateRoute,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(SavedPage), findsOneWidget);
    repository.changes.add(null);
    await tester.pumpAndSettle();
    expect(find.byType(SavedPage), findsNothing);
    expect(find.byType(LoginPage), findsOneWidget);
  });
  testWidgets('changing mobile and desktop widths preserves page state', (
    tester,
  ) async {
    Widget atWidth(double width) => MaterialApp(
      home: MediaQuery(
        data: MediaQueryData(size: Size(width, 900)),
        child: const ResponsiveShell(child: _Counter()),
      ),
    );
    await tester.pumpWidget(atWidth(390));
    await tester.tap(find.text('Count 0'));
    await tester.pump();
    await tester.pumpWidget(atWidth(1280));
    await tester.pump();
    expect(find.text('Count 1'), findsOneWidget);
  });
}
