import 'package:flutter/material.dart';
import 'package:news_paper_app/core/utils/responsive.dart';
import 'package:news_paper_app/presentation/widgets/app_drawer.dart';

/// Wraps every top-level page with the navigation pattern for the current
/// window size:
///
/// * compact  (< 600):   no wrapper — pages keep their own app bar / drawer.
/// * medium   (600-1023): compact [NavigationRail] with labels.
/// * expanded (>= 1024): extended rail (sidebar) with branding.
class ResponsiveShell extends StatefulWidget {
  final Widget child;

  const ResponsiveShell({super.key, required this.child});

  @override
  State<ResponsiveShell> createState() => _ResponsiveShellState();
}

class _ResponsiveShellState extends State<ResponsiveShell> {
  final _contentKey = GlobalKey();

  @override
  Widget build(BuildContext context) {
    final size = Responsive.of(context);
    final content = KeyedSubtree(key: _contentKey, child: widget.child);

    if (size.isCompact) return content;

    return Scaffold(
      body: Row(
        children: [
          SafeArea(
            right: false,
            child: AppNavigationRail(extended: size.isExpandedOrLarger),
          ),
          const VerticalDivider(thickness: 1, width: 1),
          Expanded(child: content),
        ],
      ),
    );
  }
}
