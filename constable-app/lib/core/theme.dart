import 'package:flutter/material.dart';

class AppTheme {
  // Brand Color Palette (Light Theme Police Management)
  static const Color pageBackground = Color(0xFFF5F7FA);
  static const Color cardBackground = Color(0xFFFFFFFF);
  static const Color policeNavy = Color(0xFF17365D);
  static const Color policeBlue = Color(0xFF2563EB);
  static const Color textMain = Color(0xFF172B4D);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color borderLight = Color(0xFFE2E8F0);
  static const Color policeSuccess = Color(0xFF15803D);
  static const Color policeWarning = Color(0xFFB45309);
  static const Color policeDanger = Color(0xFFB91C1C);
  static const Color policeGold = Color(0xFFD97706); // Warm badge gold
  static const Color policeAccent = Color(0xFF2563EB);

  // Backward compatibility aliases
  static const Color policeDarkBlue = Color(0xFF17365D);
  static const Color policeCardBg = Color(0xFFFFFFFF);
  static const Color policeTextMuted = Color(0xFF64748B);

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: pageBackground,
      colorScheme: const ColorScheme.light(
        primary: policeNavy,
        secondary: policeBlue,
        surface: cardBackground,
        surfaceContainerHighest: Color(0xFFF1F5F9),
        error: policeDanger,
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        onSurface: textMain,
        outline: borderLight,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: policeNavy,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: Colors.white,
          fontSize: 18,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
        ),
        iconTheme: IconThemeData(color: Colors.white),
      ),
      cardTheme: CardThemeData(
        color: cardBackground,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: borderLight, width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: policeNavy,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.3,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: cardBackground,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: borderLight),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: borderLight),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: policeNavy, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: policeDanger),
        ),
        labelStyle: const TextStyle(color: textSecondary),
        hintStyle: const TextStyle(color: Color(0xFF94A3B8)),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: cardBackground,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        titleTextStyle: const TextStyle(
          color: textMain,
          fontSize: 18,
          fontWeight: FontWeight.w700,
        ),
        contentTextStyle: const TextStyle(
          color: textSecondary,
          fontSize: 14,
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: cardBackground,
        selectedItemColor: policeNavy,
        unselectedItemColor: textSecondary,
        elevation: 8,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
        unselectedLabelStyle: TextStyle(fontWeight: FontWeight.w500, fontSize: 12),
      ),
    );
  }

  static ThemeData get darkTheme => lightTheme;
}
