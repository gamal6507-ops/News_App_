import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:news_paper_app/domain/entities/user_entity.dart';
import 'package:news_paper_app/domain/repositories/base_user_repository.dart';
import 'package:news_paper_app/presentation/cubits/auth/auth_cubit.dart';
import 'package:news_paper_app/presentation/pages/splash_page.dart';

const user = UserEntity(
  id: 'test-user',
  name: 'Test',
  email: 'test@example.com',
);

class _Repository implements BaseAuthRepository {
  final changes = StreamController<UserEntity?>.broadcast();
  UserEntity? current;
  int loginCalls = 0;
  Completer<UserEntity>? pendingGoogle;
  @override
  Stream<UserEntity?> get authStateChanges => changes.stream;
  @override
  UserEntity? getCurrentUser() => current;
  @override
  Future<UserEntity> login({
    required String email,
    required String password,
  }) async {
    loginCalls++;
    return user;
  }

  @override
  Future<UserEntity> register({
    required String name,
    required String email,
    required String password,
  }) async => user;
  @override
  Future<UserEntity> signInWithGoogle() async =>
      pendingGoogle == null ? user : pendingGoogle!.future;
  @override
  Future<void> logout() async {}
  @override
  Future<void> sendPasswordResetEmail({required String email}) async {}
}

void main() {
  testWidgets(
    'a stalled Google popup releases the loading state with an error',
    (tester) async {
      final repository = _Repository()..pendingGoogle = Completer<UserEntity>();
      final cubit = AuthCubit(repository);
      addTearDown(repository.changes.close);
      addTearDown(cubit.close);
      final pending = cubit.signInWithGoogle();
      await tester.pump(const Duration(seconds: 91));
      await pending;
      expect(cubit.state, isA<AuthError>());
      repository.pendingGoogle!.complete(user);
      await tester.pump();
      expect(cubit.state, isA<AuthError>());
    },
  );
  for (final method in ['google', 'register', 'email']) {
    test(
      '$method completes from the returned user without a new auth stream event',
      () async {
        final repository = _Repository();
        if (method == 'email') repository.current = user;
        final cubit = AuthCubit(repository);
        addTearDown(repository.changes.close);
        addTearDown(cubit.close);
        if (method == 'google') await cubit.signInWithGoogle();
        if (method == 'register') {
          await cubit.register(
            name: 'Test',
            email: user.email,
            password: 'test-password',
          );
        }
        if (method == 'email') {
          await cubit.login(email: user.email, password: 'test-password');
          expect(repository.loginCalls, 1);
        }
        expect(cubit.state, isA<AuthSuccess>());
        expect((cubit.state as AuthSuccess).user.id, 'test-user');
      },
    );
  }

  testWidgets(
    'splash waits for restored authentication before choosing a route',
    (tester) async {
      final repository = _Repository();
      addTearDown(repository.changes.close);
      await tester.pumpWidget(
        BlocProvider(
          create: (_) => AuthCubit(repository),
          child: MaterialApp(
            initialRoute: '/splash',
            routes: {
              '/splash': (_) => const SplashPage(),
              '/': (_) => const Scaffold(body: Text('Authenticated home')),
              '/login': (_) => const Scaffold(body: Text('Signed out login')),
            },
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 1500));
      await tester.pump();
      expect(find.text('Signed out login'), findsNothing);
      repository.changes.add(user);
      await tester.pumpAndSettle();
      expect(find.text('Authenticated home'), findsOneWidget);
    },
  );

  test(
    'closing during Google authentication ignores its late result',
    () async {
      final repository = _Repository()..pendingGoogle = Completer<UserEntity>();
      final cubit = AuthCubit(repository);
      addTearDown(repository.changes.close);
      final pending = cubit.signInWithGoogle();
      await cubit.close();
      repository.pendingGoogle!.complete(user);
      await expectLater(pending, completes);
    },
  );
}
