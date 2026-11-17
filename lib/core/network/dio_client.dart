import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:news_paper_app/core/utils/api_constants.dart';

class DioClient {
  final Dio dio;

  DioClient() : dio = Dio(_createBaseOptions()) {
    dio.interceptors.removeImplyContentTypeInterceptor();
  }

  static BaseOptions _createBaseOptions() {
    final apiKey = dotenv.env['NEWS_API_KEY'];
    final isLocalWeb =
        kIsWeb &&
        (Uri.base.host == 'localhost' || Uri.base.host == '127.0.0.1');
    final useWebProxy =
        kIsWeb && (!isLocalWeb || apiKey == null || apiKey.isEmpty);

    return BaseOptions(
      baseUrl: useWebProxy
          ? '${Uri.base.origin}/api/news'
          : ApiConstants.baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      sendTimeout: const Duration(seconds: 10),
      queryParameters: useWebProxy ? const {} : {'apiKey': apiKey},
    );
  }
}
