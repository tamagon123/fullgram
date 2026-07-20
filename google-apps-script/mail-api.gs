/**
 * fullgram Portal Site 用 メール通知 + Google Drive 自動保存 API
 *
 * デプロイ方法:
 * 1. https://script.google.com/ で新しいプロジェクトを作成
 * 2. このコードを貼り付ける
 * 3. 「デプロイ」→「新しいデプロイ」→「種類の選択」→「Webアプリ」
 * 4. 実行ユーザー: 自分
 *    アクセスできるユーザー: 全員
 * 5. デプロイして Web App URL を取得
 * 6. アプリ側の「通知設定」に URL を設定
 *
 * 初回実行時は Gmail / Google Drive へのアクセス権限承認が必要です。
 */

const GAS_TOKEN = 'fullgram-portal-token-2026';
const DEFAULT_TO_EMAIL = 'tamagon123@gmail.com';
const DRIVE_FOLDER_ID = '1y_i3qFdUqNQgPqLooP-sSVs8xXJ4XBhk';
const POLICY_STATUS_SHEET_NAME = 'PolicyStatus';
const ACTIVITY_LOG_SHEET_NAME = 'ActivityLog';
const POLICY_STATUS_SPREADSHEET_PROPERTY = 'POLICY_STATUS_SPREADSHEET_ID';

function doGet(e) {
  const parameter = e.parameter || {};
  const payload = parameter.token === GAS_TOKEN && parameter.action === 'getPolicyStatuses'
    ? { success: true, statuses: getPolicyStatuses() }
    : { success: false, error: 'Invalid request' };
  const callback = parameter.callback;

  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService
      .createTextOutput(`${callback}(${JSON.stringify(payload)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return jsonResponse(payload);
}

function doPost(e) {
  Logger.log('doPost called');
  Logger.log(e.postData.contents);

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return jsonResponse({ success: false, error: 'Lock timeout' });
  }

  let driveResult = null;
  let driveError = null;
  let policyStatusError = null;
  let data = {};

  try {
    data = JSON.parse(e.postData.contents || '{}');

    if (data.token !== GAS_TOKEN) {
      lock.releaseLock();
      return jsonResponse({ success: false, error: 'Invalid token' });
    }

    if (data.policyStatus && data.policyStatus.key) {
      try {
        savePolicyStatus(data.policyStatus);
      } catch (error) {
        policyStatusError = error.toString();
        Logger.log(`Policy status save failed: ${policyStatusError}`);
      }
    }

    if (data.activityLog) {
      try {
        saveActivityLog(data.activityLog, data);
      } catch (error) {
        Logger.log(`Activity log save failed: ${error}`);
      }
    }

    if (data.saveToDrive && data.saveToDrive.filename && data.saveToDrive.content) {
      try {
        driveResult = saveToDrive(data.saveToDrive.filename, data.saveToDrive.content, data.saveToDrive.mimeType);
      } catch (error) {
        driveError = error.toString();
      }
    }

    const subject = `[fullgram Portal] ${data.type || 'データ'}の${data.action || '更新'}通知`;
    const body = buildEmailBody(data, driveResult, driveError, policyStatusError);

    GmailApp.sendEmail(
      data.to || DEFAULT_TO_EMAIL,
      subject,
      body,
      { name: 'fullgram Portal' }
    );

    lock.releaseLock();

    if (driveError || policyStatusError) {
      return jsonResponse({ success: false, error: driveError || policyStatusError, drive: driveResult });
    }

    return jsonResponse({ success: true, drive: driveResult });
  } catch (error) {
    lock.releaseLock();
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function getPolicyStatusSpreadsheet() {
  const properties = PropertiesService.getScriptProperties();
  let spreadsheetId = properties.getProperty(POLICY_STATUS_SPREADSHEET_PROPERTY);

  if (!spreadsheetId) {
    const spreadsheet = SpreadsheetApp.create('fullgram Portal - Policy Approval Status');
    spreadsheetId = spreadsheet.getId();
    properties.setProperty(POLICY_STATUS_SPREADSHEET_PROPERTY, spreadsheetId);
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  DriveApp.getFileById(spreadsheetId).moveTo(folder);
  return spreadsheet;
}

function getPolicyStatusSheet() {
  const spreadsheet = getPolicyStatusSpreadsheet();
  let sheet = spreadsheet.getSheetByName(POLICY_STATUS_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(POLICY_STATUS_SHEET_NAME);
    sheet.appendRow(['key', 'approved', 'lastApproved', 'versions', 'updatedAt']);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function savePolicyStatus(status) {
  const sheet = getPolicyStatusSheet();
  const values = sheet.getDataRange().getValues();
  const row = [
    status.key,
    status.approved === true,
    status.lastApproved || '',
    Number(status.versions) || 0,
    new Date().toISOString()
  ];
  const existingRowIndex = values.findIndex((value, index) => index > 0 && value[0] === status.key);

  if (existingRowIndex === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(existingRowIndex + 1, 1, 1, row.length).setValues([row]);
  }
}

function getPolicyStatuses() {
  const sheet = getPolicyStatusSheet();
  const values = sheet.getDataRange().getValues();
  const statuses = {};

  values.slice(1).forEach(row => {
    if (!row[0]) return;
    statuses[row[0]] = {
      approved: row[1] === true || row[1] === 'TRUE',
      lastApproved: row[2] || null,
      versions: Number(row[3]) || 0
    };
  });

  return statuses;
}

function getActivityLogSheet() {
  const spreadsheet = getPolicyStatusSpreadsheet();
  let sheet = spreadsheet.getSheetByName(ACTIVITY_LOG_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(ACTIVITY_LOG_SHEET_NAME);
    sheet.appendRow(['timestamp', 'deviceId', 'browser', 'type', 'action', 'itemName', 'detail', 'sourceUrl']);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function saveActivityLog(activityLog, data) {
  const sheet = getActivityLogSheet();
  sheet.appendRow([
    new Date(),
    activityLog.deviceId || '',
    activityLog.browser || '',
    data.type || '',
    data.action || '',
    data.itemName || '',
    data.detail || '',
    activityLog.sourceUrl || ''
  ]);
}

function saveToDrive(filename, content, mimeType) {
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const type = mimeType || MimeType.PLAIN_TEXT;
  const files = folder.getFilesByName(filename);

  if (files.hasNext()) {
    const file = files.next();
    file.setContent(content);
    return { updated: true, filename: filename, id: file.getId() };
  }

  const file = folder.createFile(filename, content, type);
  return { created: true, filename: filename, id: file.getId() };
}

function buildEmailBody(data, driveResult, driveError, policyStatusError) {
  const lines = [
    'fullgram Portal Site のデータ登録が更新されました。',
    '',
    `【種類】 ${data.type || '-'}`,
    `【操作】 ${data.action || '-'}`,
    `【項目名】 ${data.itemName || '-'}`,
    `【日時】 ${new Date().toLocaleString('ja-JP')}`,
    ''
  ];

  if (data.detail) {
    lines.push('【詳細】');
    lines.push(data.detail);
    lines.push('');
  }

  if (driveResult) {
    lines.push('【Google Drive 自動保存】');
    if (driveResult.updated) {
      lines.push(`${driveResult.filename} を更新しました`);
    } else {
      lines.push(`${driveResult.filename} を新規作成しました`);
    }
    lines.push(`https://drive.google.com/file/d/${driveResult.id}/view`);
    lines.push('');
  }

  if (driveError) {
    lines.push('【Google Drive 自動保存エラー】');
    lines.push(driveError);
    lines.push('');
  }

  if (policyStatusError) {
    lines.push('【ポリシー承認状態の保存エラー】');
    lines.push(policyStatusError);
    lines.push('');
  }

  return lines.join('\n');
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   以下はデバッグ用関数です。
   実行したい関数の名前を選択して「実行」してください。
   ============================================================ */

function testDriveAccess() {
  try {
    Logger.log('DRIVE_FOLDER_ID: ' + DRIVE_FOLDER_ID);
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    Logger.log('フォルダ名: ' + folder.getName());
    const newFile = folder.createFile('gas-test.txt', 'test', MimeType.PLAIN_TEXT);
    Logger.log('ファイル作成成功: ' + newFile.getId());
  } catch (e) {
    Logger.log('エラー: ' + e.toString());
  }
}

function testSaveToDrive() {
  saveToDrive('test.json', '{"test": true}', MimeType.JSON);
}

function testSaveDebug() {
  try {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    Logger.log('フォルダ名: ' + folder.getName());
    const result = saveToDrive('test.json', '{"test": true}', MimeType.JSON);
    Logger.log('結果: ' + JSON.stringify(result));
  } catch (e) {
    Logger.log('エラー: ' + e.toString());
  }
}
