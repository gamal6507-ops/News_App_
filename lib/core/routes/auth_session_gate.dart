import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:news_paper_app/presentation/cubits/auth/auth_cubit.dart';
import 'package:news_paper_app/presentation/pages/login_page.dart';

/// Rechecks the session even when an old route is revealed after signing out.
class AuthSessionGate extends StatelessWidget {
  final Widget child;
  const AuthSessionGate({super.key, required this.child});

  @override
  Widget build(BuildContext context) => BlocBuilder<AuthCubit, AuthState>(
    builder: (_, state) => state is AuthSuccess ? child : const LoginPage(),
  );
}
