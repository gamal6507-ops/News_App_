// presentation/cubits/auth/auth_cubit.dart
import 'dart:async';
import 'package:easy_localization/easy_localization.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:news_paper_app/core/errors/exceptions.dart';
import 'package:news_paper_app/core/service/notification_service.dart';
import 'package:news_paper_app/domain/entities/user_entity.dart';
import 'package:news_paper_app/domain/repositories/base_user_repository.dart';

part 'auth_state.dart';

class AuthCubit extends Cubit<AuthState> {
  AuthCubit(this._repository) : super(AuthInitial()) {
    _authSubscription = _repository.authStateChanges.listen(
      (user) {
        if (isClosed) return;
        if (!_initialAuthReady.isCompleted) _initialAuthReady.complete();
        if (user != null) {
          emit(AuthSuccess(user: user));
        } else if (state is! AuthInitial && state is! AuthLoading) {
          emit(AuthInitial());
        }
      },
      onError: (Object _) {
        if (!_initialAuthReady.isCompleted) _initialAuthReady.complete();
        if (!isClosed) {
          emit(
            AuthError(
              message: 'Could not restore your session. Please sign in again.'
                  .tr(),
            ),
          );
        }
      },
    );
  }

  final BaseAuthRepository _repository;
  late final StreamSubscription<UserEntity?> _authSubscription;
  final _initialAuthReady = Completer<void>();
  int _operationId = 0;

  Future<void> get ready => _initialAuthReady.future;

  Future<void> login({required String email, required String password}) async {
    await _authenticate(LoginMethod.email, () async {
      if (!kIsWeb) {
        final previousUserId = _repository.getCurrentUser()?.id;
        if (previousUserId != null) {
          try {
            await FirebaseFirestore.instance
                .collection('users')
                .doc(previousUserId)
                .update({'fcmToken': FieldValue.delete()})
                .timeout(const Duration(seconds: 2));
          } catch (_) {
            // A missing notification record must not block authentication.
          }
        }
      }
      return _repository.login(email: email, password: password);
    });
  }

  Future<void> register({
    required String name,
    required String email,
    required String password,
  }) async {
    await _authenticate(
      LoginMethod.email,
      () => _repository.register(name: name, email: email, password: password),
    );
  }

  Future<void> sendPasswordResetEmail({required String email}) async {
    emit(AuthLoading(loginMethod: LoginMethod.email));
    try {
      await _repository.sendPasswordResetEmail(email: email);
      emit(PasswordResetEmailSent());
    } on ServerException catch (e) {
      emit(AuthError(message: e.message));
    } catch (_) {
      emit(const AuthError(message: 'Something went wrong. Please try again.'));
    }
  }

  Future<void> logout() async {
    _operationId++;
    await _repository.logout();
    if (!isClosed) emit(AuthInitial());
  }

  Future<void> signInWithGoogle() async {
    await _authenticate(LoginMethod.google, _repository.signInWithGoogle);
  }

  Future<void> _authenticate(
    LoginMethod method,
    Future<UserEntity> Function() action,
  ) async {
    if (isClosed || state is AuthLoading) return;
    final operationId = ++_operationId;
    emit(AuthLoading(loginMethod: method));
    try {
      final user = await action().timeout(const Duration(seconds: 90));
      if (isClosed || operationId != _operationId) return;
      emit(AuthSuccess(user: user));
      unawaited(_saveFcmToken());
    } on ServerException catch (e) {
      if (isClosed || operationId != _operationId) return;
      if (e.message == 'Sign in cancelled.') {
        emit(AuthInitial());
        return;
      }
      emit(AuthError(message: e.message));
    } on TimeoutException {
      if (isClosed || operationId != _operationId) return;
      emit(
        AuthError(
          message:
              'Sign-in timed out. Close the old sign-in window and try again.'
                  .tr(),
        ),
      );
    } catch (_) {
      if (isClosed || operationId != _operationId) return;
      emit(const AuthError(message: 'Something went wrong. Please try again.'));
    }
  }

  Future<void> _saveFcmToken() async {
    if (kIsWeb) return;
    try {
      final token = await NotificationService().getToken();
      final userId = _repository.getCurrentUser()?.id;
      if (token == null || userId == null) return;
      await FirebaseFirestore.instance.collection('users').doc(userId).set({
        'fcmToken': token,
      }, SetOptions(merge: true));
    } catch (_) {
      // Notification registration must never turn a successful login into an error.
    }
  }

  @override
  Future<void> close() {
    _operationId++;
    if (!_initialAuthReady.isCompleted) _initialAuthReady.complete();
    _authSubscription.cancel();
    return super.close();
  }
}
