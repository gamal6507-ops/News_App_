import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:news_paper_app/core/service/service_locator.dart';
import 'package:news_paper_app/presentation/cubits/country/country_cubit.dart';
import 'package:news_paper_app/presentation/cubits/news/news_cubit.dart';
import 'package:news_paper_app/presentation/widgets/home_widgets/home_view.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CountryCubit, CountryState>(
      builder: (context, country) {
        if (country.isLoading) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        return BlocProvider(
          key: ValueKey(country.countryCode),
          create: (_) =>
              sl<NewsCubit>()..getTopHeadlines(country: country.countryCode),
          child: const HomeView(),
        );
      },
    );
  }
}
