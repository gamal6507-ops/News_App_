import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:news_paper_app/core/errors/exceptions.dart';
import 'package:news_paper_app/domain/entities/article.dart';
import 'package:news_paper_app/domain/usecases/news/get_top_headlines_use_case.dart';
import 'package:news_paper_app/presentation/cubits/news/news_state.dart';

class NewsCubit extends Cubit<NewsState> {
  final GetTopHeadlinesUseCase getTopHeadlinesUseCase;

  NewsCubit(this.getTopHeadlinesUseCase) : super(const NewsInitial());

  final List<Article> _articles = [];

  String? _country;
  String? _category;
  int _requestId = 0;
  int _currentPage = 1;
  int _totalResult = 0;

  bool _isLoadingMore = false;

  bool _hasMore = true;

  List<Article> get articles => List.unmodifiable(_articles);

  bool get hasMore => _hasMore;

  Future<void> getTopHeadlines({
    String? country,
    String? category,
    bool refresh = false,
  }) async {
    if (isClosed) return;
    final requestId = ++_requestId;
    final nextCategory = category?.trim().toLowerCase();
    if (nextCategory != null && nextCategory != _category) {
      _category = nextCategory.isEmpty ? null : nextCategory;
      refresh = true;
    }
    if (country != null) {
      final newCountryCode = country.toLowerCase();

      if (newCountryCode != _country) {
        _country = newCountryCode;

        // إعادة ضبط الصفحات عند تغيير الدولة.
        _currentPage = 1;
        _totalResult = 0;
        _isLoadingMore = false;
        _hasMore = true;
        refresh = true;
      }
    }
    debugPrint('GET TOP HEADLINES CALLED');
    _isLoadingMore = false;

    if (refresh) {
      _currentPage = 1;
      _totalResult = 0;
      _hasMore = true;
      _articles.clear();
    }

    emit(const NewsLoading());

    try {
      debugPrint('API RESULT RECEIVED');
      final result = await getTopHeadlinesUseCase(
        country: _country,
        category: _category,
        page: _currentPage,
        pageSize: 12,
      );

      final newArticles = result.articles;
      if (isClosed || requestId != _requestId) return;
      debugPrint('Total Results: ${result.totalResults}');
      debugPrint('Articles Count: ${newArticles.length}');
      _totalResult = result.totalResults;

      _articles
        ..clear()
        ..addAll(newArticles);

      _hasMore = newArticles.length == 12;
      emit(NewsLoaded(List.unmodifiable(_articles), hasMore: _hasMore));
    } on NetworkException catch (e) {
      if (isClosed || requestId != _requestId) return;
      emit(NewsError(e.message));
    } on ServerException catch (e) {
      if (isClosed || requestId != _requestId) return;
      emit(NewsError(e.message));
    } on CacheException catch (e) {
      if (isClosed || requestId != _requestId) return;
      emit(NewsError(e.message));
    } catch (_) {
      if (isClosed || requestId != _requestId) return;
      emit(const NewsError('Something went wrong. Please try again.'));
    }
  }

  Future<void> loadMore({String? country, String? category}) async {
    if (isClosed || _isLoadingMore || !_hasMore) {
      return;
    }

    _isLoadingMore = true;
    final requestId = ++_requestId;

    emit(NewsLoadingMore(List.unmodifiable(_articles), hasMore: _hasMore));

    try {
      final nextPage = _currentPage + 1;

      final result = await getTopHeadlinesUseCase(
        country: country ?? _country,
        category: category?.toLowerCase() ?? _category,
        page: nextPage,
        pageSize: 12,
      );
      final newArticles = result.articles;
      if (isClosed || requestId != _requestId) return;
      if (newArticles.isEmpty) {
        _hasMore = false;
      } else {
        _currentPage = nextPage;

        _articles.addAll(newArticles);
        _totalResult = result.totalResults;
        _hasMore = _articles.length < _totalResult;
      }

      emit(NewsLoaded(List.unmodifiable(_articles), hasMore: _hasMore));
    } on NetworkException catch (_) {
      if (isClosed || requestId != _requestId) return;
      emit(NewsLoaded(List.unmodifiable(_articles), hasMore: _hasMore));
    } on ServerException catch (_) {
      if (isClosed || requestId != _requestId) return;
      emit(NewsLoaded(List.unmodifiable(_articles), hasMore: _hasMore));
    } catch (_) {
      if (isClosed || requestId != _requestId) return;
      emit(NewsLoaded(List.unmodifiable(_articles), hasMore: _hasMore));
    } finally {
      if (requestId == _requestId) _isLoadingMore = false;
    }
  }

  @override
  Future<void> close() {
    _requestId++;
    return super.close();
  }
}
