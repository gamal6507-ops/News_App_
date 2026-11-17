import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:news_paper_app/core/service/news_country_service.dart';
import 'package:news_paper_app/presentation/cubits/country/country_cubit.dart';

class _PendingCountryService extends NewsCountryService {
  final pending = Completer<NewsCountry>();
  @override
  Future<NewsCountry> loadOrDetect() => pending.future;
  @override
  Future<void> save(NewsCountry country) async {}
}

void main() {
  testWidgets(
    'unanswered location permission cannot block the feed indefinitely',
    (tester) async {
      final service = _PendingCountryService();
      final cubit = CountryCubit(service);
      addTearDown(cubit.close);
      unawaited(cubit.initialize());
      await tester.pump(const Duration(seconds: 11));
      expect(cubit.state.isLoading, isFalse);
      expect(cubit.state.countryCode, 'eg');
    },
  );

  test('manual country choice wins over late startup detection', () async {
    final service = _PendingCountryService();
    final cubit = CountryCubit(service);
    addTearDown(cubit.close);
    final initialization = cubit.initialize();
    await cubit.selectCountry(countryCode: 'US', countryName: 'United States');
    service.pending.complete(const NewsCountry(code: 'eg', name: 'Egypt'));
    await initialization;
    expect(cubit.state.countryCode, 'us');
  });

  test('closing during location detection does not emit after close', () async {
    final service = _PendingCountryService();
    final cubit = CountryCubit(service);
    final initialization = cubit.initialize();
    await cubit.close();
    service.pending.complete(const NewsCountry(code: 'eg', name: 'Egypt'));
    await expectLater(initialization, completes);
  });
}
