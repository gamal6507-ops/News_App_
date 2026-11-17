import 'dart:async';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:news_paper_app/core/errors/failuer.dart';
import 'package:news_paper_app/domain/entities/news_result.dart';
import 'package:news_paper_app/domain/repositories/base_search_repository.dart';
import 'package:news_paper_app/domain/usecases/search/get_everthing_use_case.dart';
import 'package:news_paper_app/presentation/cubits/search/search_cubit.dart';

class _SearchRepository implements BaseSearchRepository {
  final pending = <Completer<Either<Failure, NewsResult>>>[];
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
  }) {
    final completer = Completer<Either<Failure, NewsResult>>();
    pending.add(completer);
    return completer.future;
  }

  @override
  Future<List<String>> getRecentSearches() async => ['saved query'];
  @override
  Future<void> saveRecentSearch(String query) async {}
  @override
  Future<void> removeSearch(String query) async {}
  @override
  Future<void> clearSearches() async {}
}

const _result = Right<Failure, NewsResult>(
  NewsResult(articles: [], totalResults: 0),
);

void main() {
  test('late suggestions cannot replace submitted search results', () async {
    final repository = _SearchRepository();
    final cubit = SearchCubit(GetEverythingUseCase(repository), repository);
    addTearDown(cubit.close);
    final suggestions = cubit.getSuggestions('flutter');
    final search = cubit.search('flutter');
    repository.pending[1].complete(_result);
    await search;
    repository.pending[0].complete(_result);
    await suggestions;
    expect(cubit.state, isA<SearchLoaded>());
  });

  test(
    'clearing input keeps recent searches after pending results arrive',
    () async {
      final repository = _SearchRepository();
      final cubit = SearchCubit(GetEverythingUseCase(repository), repository);
      addTearDown(cubit.close);
      final search = cubit.search('flutter');
      await cubit.getRecentSearches();
      repository.pending.single.complete(_result);
      await search;
      expect(cubit.state, isA<RecentSearchesLoaded>());
    },
  );
}
