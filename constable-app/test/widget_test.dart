import 'package:flutter_test/flutter_test.dart';
import 'package:constable_app/main.dart';

void main() {
  testWidgets('Constable app smoke test renders login title', (WidgetTester tester) async {
    await tester.pumpWidget(const PoliceHQConstableApp());
    expect(find.text('PoliceHQ GeoAttend'), findsOneWidget);
  });
}
