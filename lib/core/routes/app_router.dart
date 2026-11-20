import 'package:flutter/material.dart';
import 'package:news_paper_app/core/routes/app_routes.dart';
import 'package:news_paper_app/core/routes/auth_session_gate.dart';
import 'package:news_paper_app/domain/entities/article.dart';
import 'package:news_paper_app/presentation/pages/article_details_page.dart';
import 'package:news_paper_app/presentation/pages/login_page.dart';
import 'package:news_paper_app/presentation/pages/privacy_policy_page.dart';
import 'package:news_paper_app/presentation/pages/register_page.dart';
import 'package:news_paper_app/presentation/pages/saved_page.dart';
import 'package:news_paper_app/presentation/pages/home_page.dart';
import 'package:news_paper_app/presentation/pages/notifications_page.dart';
import 'package:news_paper_app/presentation/pages/search_page.dart';
import 'package:news_paper_app/presentation/pages/settings_page.dart';
import 'package:news_paper_app/presentation/pages/splash_page.dart';
import 'package:news_paper_app/presentation/widgets/responsive_shell.dart';

class AppRouter {
  static Route<dynamic> _protected(RouteSettings settings, Widget child) =>
      MaterialPageRoute(
        settings: settings,
        builder: (_) => AuthSessionGate(child: child),
      );

  static Route<dynamic> onGenerateRoute(RouteSettings settings) {
    switch (settings.name) {
      case AppRoutes.splashPageRoute:
        return MaterialPageRoute(
          settings: settings,
          builder: (_) => const SplashPage(),
        );
      case AppRoutes.loginPageRoute:
        return MaterialPageRoute(
          settings: settings,
          builder: (_) => const LoginPage(),
        );
      case AppRoutes.registerPageRoute:
        return MaterialPageRoute(
          settings: settings,
          builder: (_) => const RegisterPage(),
        );
      case AppRoutes.homePageRoute:
        return _protected(settings, const ResponsiveShell(child: HomePage()));
      case AppRoutes.searchPageRoute:
        final autoFocus = settings.arguments as bool? ?? false;
        return _protected(
          settings,
          ResponsiveShell(child: SearchPage(autoFocus: autoFocus)),
        );
      case AppRoutes.articleDetailsPageRoute:
        final article = settings.arguments;
        return _protected(
          settings,
          article is Article
              ? ArticleDetailsPage(article: article)
              : const ResponsiveShell(child: HomePage()),
        );
      case AppRoutes.notificationPageRoute:
        return _protected(
          settings,
          const ResponsiveShell(child: NotificationPage()),
        );
      case AppRoutes.savedPageRoute:
        return _protected(settings, const ResponsiveShell(child: SavedPage()));
      case AppRoutes.settingsPageRoute:
        return _protected(
          settings,
          const ResponsiveShell(child: SettingsPage()),
        );
      case AppRoutes.privacyPolicyPageRoute:
        return MaterialPageRoute(
          settings: settings,
          builder: (_) => const PrivacyPolicyPage(),
        );
      default:
        return _protected(settings, const ResponsiveShell(child: HomePage()));
    }
  }
}
