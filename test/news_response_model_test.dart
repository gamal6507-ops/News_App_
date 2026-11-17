import 'package:flutter_test/flutter_test.dart';
import 'package:news_paper_app/data/models/news_response_model.dart';

void main() {
  test('keeps real articles without thumbnails for placeholder rendering', () {
    final response = NewsResponseModel.fromJson({
      'status': 'ok',
      'totalResults': 1,
      'articles': [
        {
          'source': {'name': 'Publisher'},
          'title': 'Latest headline',
          'url': 'https://example.com/article',
          'urlToImage': null,
        },
      ],
    });
    expect(response.articles, hasLength(1));
    expect(response.articles.single.imageUrl, isNull);
  });
}
