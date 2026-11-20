import 'package:dartz/dartz.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:news_paper_app/core/errors/failuer.dart';
import 'package:news_paper_app/domain/entities/news_result.dart';
import 'package:news_paper_app/domain/repositories/base_search_repository.dart';
import 'package:news_paper_app/domain/usecases/search/get_everthing_use_case.dart';
import 'package:news_paper_app/presentation/cubits/search/search_cubit.dart';
import 'package:news_paper_app/presentation/widgets/search_widgets/search_filter_sheet.dart';

class _Loader extends AssetLoader {
  const _Loader();
  @override
  Future<Map<String, dynamic>> load(String path, Locale locale) async => {
    for (final key in [
      'From',
      'To',
      'Filters',
      'Clear All',
      'Sort by',
      'Relevance',
      'Popularity',
      'PublishedAt',
      'Language',
      'Arabic',
      'English',
      'German',
      'French',
      'Russian',
      'Italian',
      'Spanish',
      'Portuguese',
      'Chinese',
      'Japanese',
      'Korean',
      'Date',
      'Sources',
      'Cancel',
      'Apply',
      'Example: bbc-news, cnn',
    ])
      key: key,
  };
}

class _Repository implements BaseSearchRepository {
  String? requestedSort;
  @override
  Future<Either<Failure, NewsResult>> getEverything({
    required String query,
    String? sources,
    String? language,
    DateTime? from,
    DateTime? to,
    String? sortBy,
    int page = 1,
    int pageSize = 20,
  }) async {
    requestedSort = sortBy;
    return const Right(NewsResult(articles: [], totalResults: 0));
  }

  @override
  Future<List<String>> getRecentSearches() async => [];
  @override
  Future<void> saveRecentSearch(String query) async {}
  @override
  Future<void> removeSearch(String query) async {}
  @override
  Future<void> clearSearches() async {}
}

Future<void> mount(WidgetTester tester, SearchCubit cubit) async {
  tester.view.physicalSize = const Size(700, 1400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    EasyLocalization(
      supportedLocales: const [Locale('en')],
      startLocale: const Locale('en'),
      path: 'test',
      saveLocale: false,
      assetLoader: const _Loader(),
      child: Builder(
        builder: (context) => BlocProvider.value(
          value: cubit,
          child: MaterialApp(
            locale: context.locale,
            supportedLocales: context.supportedLocales,
            localizationsDelegates: context.localizationDelegates,
            home: const Scaffold(body: SearchFilterSheet()),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'date picker accepts today and does not crash outside old hardcoded dates',
    (tester) async {
      final repository = _Repository();
      final cubit = SearchCubit(GetEverythingUseCase(repository), repository);
      addTearDown(cubit.close);
      await mount(tester, cubit);
      await tester.ensureVisible(find.text('From'));
      await tester.tap(find.text('From'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      final picker = tester.widget<CalendarDatePicker>(
        find.byType(CalendarDatePicker),
      );
      expect(picker.lastDate, DateUtils.dateOnly(DateTime.now()));
      expect(picker.initialDate, DateUtils.dateOnly(DateTime.now()));
    },
  );

  testWidgets(
    'reopening filters shows active language source and sort selection',
    (tester) async {
      final repository = _Repository();
      final cubit = SearchCubit(GetEverythingUseCase(repository), repository);
      addTearDown(cubit.close);
      cubit.updateFilter(
        language: 'ar',
        sortBy: 'publishedAt',
        sources: 'bbc-news',
      );
      await mount(tester, cubit);
      final arabic = tester.widget<ChoiceChip>(
        find.widgetWithText(ChoiceChip, 'Arabic'),
      );
      expect(arabic.selected, isTrue);
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        'bbc-news',
      );
    },
  );

  testWidgets('relevance filter uses the NewsAPI relevancy value', (
    tester,
  ) async {
    final repository = _Repository();
    final cubit = SearchCubit(GetEverythingUseCase(repository), repository);
    addTearDown(cubit.close);
    await cubit.search('news');
    await mount(tester, cubit);
    await tester.tap(find.text('Relevance'));
    await tester.ensureVisible(find.text('Apply'));
    await tester.tap(find.text('Apply'));
    await tester.pumpAndSettle();
    expect(repository.requestedSort, 'relevancy');
  });
}
