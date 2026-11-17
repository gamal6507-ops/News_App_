import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:news_paper_app/core/routes/app_routes.dart';
import 'package:news_paper_app/presentation/cubits/auth/auth_cubit.dart';

class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> {
  static const String _logoAsset =
      'assets/logos/al-akhbar-mauritania-logo-png_seeklogo-505945.png';

  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(const Duration(milliseconds: 1200), _navigateNext);
  }

  Future<void> _navigateNext() async {
    if (!mounted) return;
    final authCubit = context.read<AuthCubit>();
    try {
      await authCubit.ready.timeout(const Duration(seconds: 10));
    } on TimeoutException {
      // Allow a retry from login if browser session storage cannot initialize.
    }
    if (!mounted) return;
    final authState = authCubit.state;
    final targetRoute = authState is AuthSuccess
        ? AppRoutes.homePageRoute
        : AppRoutes.loginPageRoute;
    Navigator.of(context).pushReplacementNamed(targetRoute);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0.9, end: 1.0),
          duration: const Duration(milliseconds: 500),
          curve: Curves.easeOutCubic,
          builder: (context, scale, child) {
            return Transform.scale(scale: scale, child: child);
          },
          child: Image.asset(_logoAsset, width: 220, fit: BoxFit.contain),
        ),
      ),
    );
  }
}
