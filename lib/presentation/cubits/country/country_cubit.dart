import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:news_paper_app/core/service/news_country_service.dart';

class CountryState {
  final String countryCode;
  final String countryName;
  final bool isLoading;

  const CountryState({
    required this.countryCode,
    required this.countryName,
    required this.isLoading,
  });

  const CountryState.initial()
    : countryCode = '',
      countryName = '',
      isLoading = true;
}

class CountryCubit extends Cubit<CountryState> {
  final NewsCountryService _countryService;
  int _requestId = 0;

  CountryCubit(this._countryService) : super(const CountryState.initial());

  Future<void> initialize() async {
    if (isClosed) return;
    final requestId = ++_requestId;
    try {
      final country = await _countryService.loadOrDetect().timeout(
        const Duration(seconds: 10),
      );
      if (isClosed || requestId != _requestId) return;

      emit(
        CountryState(
          countryCode: country.code,
          countryName: country.name,
          isLoading: false,
        ),
      );
    } catch (_) {
      if (isClosed || requestId != _requestId) return;
      emit(
        const CountryState(
          countryCode: 'eg',
          countryName: 'Egypt',
          isLoading: false,
        ),
      );
    }
  }

  Future<void> selectCountry({
    required String countryCode,
    required String countryName,
  }) async {
    if (isClosed) return;
    final requestId = ++_requestId;
    final country = NewsCountry(
      code: countryCode.toLowerCase(),
      name: countryName,
    );

    await _countryService.save(country);
    if (isClosed || requestId != _requestId) return;

    emit(
      CountryState(
        countryCode: country.code,
        countryName: country.name,
        isLoading: false,
      ),
    );
  }

  @override
  Future<void> close() {
    _requestId++;
    return super.close();
  }
}
