const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {XMLParser} = require('fast-xml-parser');
const manifest = new XMLParser({ignoreAttributes:false}).parse(readFileSync('android/app/src/main/AndroidManifest.xml','utf8')).manifest;
const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
test('Android declares non-exported schedule and boot receivers', () => {
  const receivers = list(manifest.application.receiver);
  const scheduled = receivers.find(r=>r['@_android:name']==='com.dexterous.flutterlocalnotifications.ScheduledNotificationReceiver');
  assert.ok(scheduled, 'scheduled notification receiver is required by the plugin');
  assert.equal(scheduled['@_android:exported'],'false');
  const boot = receivers.find(r=>r['@_android:name']==='com.dexterous.flutterlocalnotifications.ScheduledNotificationBootReceiver');
  assert.ok(boot, 'boot receiver must restore reminders after restart');
  assert.equal(boot['@_android:exported'],'false');
  const actions=list(boot['intent-filter'].action).map(a=>a['@_android:name']);
  assert.ok(actions.includes('android.intent.action.BOOT_COMPLETED'));
  assert.ok(actions.includes('android.intent.action.MY_PACKAGE_REPLACED'));
});
test('inexact news reminders do not require special exact-alarm access',()=> {
  const permissions=list(manifest['uses-permission']).map(p=>p['@_android:name']);
  assert.ok(permissions.includes('android.permission.RECEIVE_BOOT_COMPLETED'));
  assert.ok(!permissions.includes('android.permission.SCHEDULE_EXACT_ALARM'));
  const service=readFileSync('lib/core/service/notification_service.dart','utf8');
  assert.match(service,/AndroidScheduleMode\.inexactAllowWhileIdle/);
  assert.ok(!service.includes('requestExactAlarmsPermission'));
});
