import 'dart:async';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:news_paper_app/core/errors/failuer.dart';
import 'package:news_paper_app/domain/entities/article.dart';
import 'package:news_paper_app/domain/entities/news_result.dart';
import 'package:news_paper_app/domain/repositories/base_newspapers_repository.dart';
import 'package:news_paper_app/domain/usecases/news/get_top_headlines_use_case.dart';
import 'package:news_paper_app/presentation/cubits/news/news_cubit.dart';
import 'package:news_paper_app/presentation/cubits/news/news_state.dart';

class _NewsRepository implements BaseNewspapersRepository {
  final requests = <({String? country, String? category, int page})>[];

  @override
  Future<Either<Failure, NewsResult>> getTopHeadlines({
    String? country = 'us',
    String? category,
    int page = 1,
    int pageSize = 20,
  }) async {
    requests.add((country: country, category: category, page: page));
    return const Right(NewsResult(articles: [], totalResults: 0));
  }

  @override
  Future<Either<Failure, List<Article>>> getSources() async => const Right([]);
}

class _DeferredNewsRepository extends _NewsRepository {
  final pending = <Completer<Either<Failure, NewsResult>>>[];
  @override
  Future<Either<Failure, NewsResult>> getTopHeadlines({
    String? country = 'us',
    String? category,
    int page = 1,
    int pageSize = 20,
  }) {
    final completer = Completer<Either<Failure, NewsResult>>();
    pending.add(completer);
    return completer.future;
  }
}

void main() {
  test(
    'closing a feed while a request is pending does not emit after close',
    () async {
      final repository = _DeferredNewsRepository();
      final cubit = NewsCubit(GetTopHeadlinesUseCase(repository));
      final request = cubit.getTopHeadlines(country: 'eg');
      await cubit.close();
      repository.pending.single.complete(
        const Right(NewsResult(articles: [], totalResults: 0)),
      );
      await expectLater(request, completes);
    },
  );

  test(
    'an outdated category failure cannot replace the latest results',
    () async {
      final repository = _DeferredNewsRepository();
      final cubit = NewsCubit(GetTopHeadlinesUseCase(repository));
      addTearDown(cubit.close);
      final oldRequest = cubit.getTopHeadlines(category: 'business');
      final newRequest = cubit.getTopHeadlines(category: 'science');
      repository.pending[1].complete(
        const Right(NewsResult(articles: [], totalResults: 0)),
      );
      await newRequest;
      repository.pending[0].complete(
        const Left(ServerFailure(message: 'old failure')),
      );
      await oldRequest;
      expect(cubit.state, isA<NewsLoaded>());
    },
  );
  test(
    'refresh retains country and normalizes the selected category',
    () async {
      final repository = _NewsRepository();
      final cubit = NewsCubit(GetTopHeadlinesUseCase(repository));
      addTearDown(cubit.close);
      await cubit.getTopHeadlines(country: 'EG', category: 'Technology');
      await cubit.getTopHeadlines(refresh: true);
      expect(repository.requests.last, (
        country: 'eg',
        category: 'technology',
        page: 1,
      ));
    },
  );

  test('selecting all explicitly clears the previous category', () async {
    final repository = _NewsRepository();
    final cubit = NewsCubit(GetTopHeadlinesUseCase(repository));
    addTearDown(cubit.close);
    await cubit.getTopHeadlines(country: 'eg', category: 'Business');
    await cubit.getTopHeadlines(category: '', refresh: true);
    expect(repository.requests.last, (country: 'eg', category: null, page: 1));
  });
}
