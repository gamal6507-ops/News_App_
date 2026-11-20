import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:news_paper_app/core/network/dio_client.dart';
import 'package:news_paper_app/data/datasource/remote_data/news_api_service.dart';

void main() {
  test(
    'native headlines use the feed fallback server without bundled secrets',
    () async {
      final client = DioClient();
      late RequestOptions request;
      client.dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            request = options;
            handler.resolve(
              Response(
                requestOptions: options,
                data: {
                  'status': 'ok',
                  'totalResults': 0,
                  'articles': <dynamic>[],
                },
              ),
            );
          },
        ),
      );
      await NewsApiService(
        client,
      ).getTopHeadlines(country: 'eg', category: 'science');
      expect(request.uri.origin, 'https://news-app-five-kappa-90.vercel.app');
      expect(request.uri.path, '/api/news/v2/top-headlines');
      expect(request.queryParameters['country'], 'eg');
      expect(request.queryParameters, isNot(contains('apiKey')));
      expect(request.headers, isNot(contains('X-Api-Key')));
      client.dio.close();
    },
  );
}
